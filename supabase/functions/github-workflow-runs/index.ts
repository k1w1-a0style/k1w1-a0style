import { corsHeadersForRequest, handleCors } from "../_shared/cors.ts";
import {
  getRequestRateLimitSubject,
  requireDurableRateLimit,
  requireWorkflowOperatorJwtRoleWithVerifiedActor,
  requireOwnerOrJwtAuth,
  rateLimit,
} from "../_shared/auth.ts";
import { githubFetch, getGithubToken, GITHUB_API_BASE } from "../_shared/github.ts";
import { sanitizeErrorText, sanitizeGitHubFailure } from "../_shared/errorSanitization.ts";
import { isParsedJsonBodyError, isSafeGitHubRepoFullName, parseJsonBody } from "../_shared/validation.ts";

/**
 * Lists GitHub Actions workflow runs.
 *
 * Input (JSON body) supports multiple aliases:
 * - githubRepo: "owner/repo"  (aliases: github_repo, repoFullName, fullName, repository, githubRepository)
 * - owner + repo (fallback)
 *
 * Optional:
 * - workflowId: workflow filename (e.g. "k1w1-triggered-build.yml") OR numeric workflow id
 *   aliases: workflow_id, workflowFile, workflow_file, workflow, path
 *   If omitted, falls back to listing *all* workflow runs for the repo.
 * - perPage (aliases: per_page)
 * - ref/branch (aliases: branch)
 * - status (optional)
 *
 * Authentication uses the shared server-side GitHub token helper.
 */

type JsonRecord = Record<string, unknown>;

const readStringLike = (record: JsonRecord, ...keys: string[]): string => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return "";
};

const readNumberish = (record: JsonRecord, fallback: number, ...keys: string[]): number => {
  for (const key of keys) {
    const value = record[key];
    const numberValue = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(numberValue) && numberValue > 0) return numberValue;
  }
  return fallback;
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const responseCorsHeaders = corsHeadersForRequest(req);

  try {
    // Legacy guard lineage: generic admin-or-CI bearer guard (removed).
    const auth = await requireOwnerOrJwtAuth(req, {
      scope: "github-workflow-runs",
      adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY",
      requireJwtRoleWithVerifiedActor: requireWorkflowOperatorJwtRoleWithVerifiedActor,
    });
    if (auth.guard) return auth.guard;
    const rateLimitSubject = getRequestRateLimitSubject(req, auth.actor);

    const durableRl = await requireDurableRateLimit(req, {
      scope: "github-workflow-runs",
      subject: rateLimitSubject,
      max: 60,
      windowMs: 60_000,
    });
    if (durableRl) return durableRl;

    const rl = rateLimit(req, "github-workflow-runs", 10, 10_000, rateLimitSubject);
    if (rl) return rl;

    const parsedBody = await parseJsonBody(req, 20_000);
    if (isParsedJsonBodyError(parsedBody)) {
      const status = parsedBody.error.toLowerCase().includes("too large") ? 413 : 400;
      return new Response(
        JSON.stringify({ ok: false, error: status === 413 ? "Request too large" : "Invalid JSON body" }),
        {
          status,
          headers: { ...responseCorsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const body = parsedBody.body as JsonRecord;

    const ownerName = readStringLike(body, "owner");
    const repoName = readStringLike(body, "repo");
    const githubRepo =
      readStringLike(body, "githubRepo", "github_repo", "repoFullName", "fullName", "repository", "githubRepository") ||
      (ownerName && repoName ? `${ownerName}/${repoName}` : "");

    if (!isSafeGitHubRepoFullName(githubRepo)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing/invalid githubRepo" }),
        {
          status: 400,
          headers: { ...responseCorsHeaders, "Content-Type": "application/json" },
        },
      );
    }


    const workflowId = readStringLike(body, "workflowId", "workflow_id", "workflowFile", "workflow_file", "workflow", "path");

    const perPage = Math.max(1, Math.min(100, readNumberish(body, 20, "perPage", "per_page")));

    const ref = readStringLike(body, "ref", "branch");
    const status = readStringLike(body, "status");
    const token = getGithubToken();
    if (!token) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing GitHub token",
          expected: ["GITHUB_TOKEN", "GH_TOKEN", "GITHUB_API_TOKEN"],
        }),
        {
          status: 500,
          headers: { ...responseCorsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const [owner, repo] = githubRepo.split("/");
    const params = new URLSearchParams();
    params.set("per_page", String(perPage));
    if (ref) params.set("branch", ref);
    if (status) params.set("status", status);

    const repoRunsUrl =
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs?` + params.toString();

    const workflowRunsUrl =
      workflowId
        ? `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowId)}/runs?` +
          params.toString()
        : repoRunsUrl;

    // Primary fetch: workflow-specific (if workflowId given) else repo-wide.
    const r = await githubFetch(workflowRunsUrl, {
      method: "GET",
    });

    const txt = await r.text();

    // If workflow file/id is not found, return fail-closed (no implicit broadening to repo-wide runs).
    if (!r.ok && r.status === 404 && workflowId) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "workflowId not found",
          details: sanitizeGitHubFailure(r, txt),
        }),
        {
          status: 404,
          headers: { ...responseCorsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!r.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "GitHub API failed",
          details: sanitizeGitHubFailure(r, txt),
        }),
        {
          status: 502,
          headers: { ...responseCorsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let json: unknown;
    try {
      json = JSON.parse(txt);
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid JSON from GitHub" }),
        {
          status: 502,
          headers: { ...responseCorsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ ok: true, data: json }), {
      status: 200,
      headers: { ...responseCorsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Unexpected error",
        message: sanitizeErrorText(error instanceof Error ? error.message : String(error)),
      }),
      {
        status: 500,
        headers: { ...responseCorsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
