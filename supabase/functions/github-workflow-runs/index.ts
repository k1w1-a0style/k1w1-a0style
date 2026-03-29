import { corsHeadersForRequest, handleCors } from "../_shared/cors.ts";
import {
  requireDurableRateLimit,
  requireWorkflowOperatorJwtRole,
  requireScopedEdgeAuth,
  rateLimit,
} from "../_shared/auth.ts";
import { githubFetch, getGithubToken, GITHUB_API_BASE } from "../_shared/github.ts";
import { sanitizeErrorText, sanitizeGitHubFailure } from "../_shared/errorSanitization.ts";

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
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const responseCorsHeaders = corsHeadersForRequest(req);

  try {
    // Legacy guard lineage: generic admin-or-CI bearer guard (removed).
    const auth = requireScopedEdgeAuth(req, {
      scope: "github-workflow-runs",
      allowAdmin: true,
      allowJwtAuthHeaderWithAdmin: true,
      adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY",
    });
    if (auth) return auth;
    const jwtRoleGuard = await requireWorkflowOperatorJwtRole(req, "github-workflow-runs");
    if (jwtRoleGuard) return jwtRoleGuard;

    const durableRl = await requireDurableRateLimit(req, {
      scope: "github-workflow-runs",
      subject: req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown",
      max: 60,
      windowMs: 60_000,
    });
    if (durableRl) return durableRl;

    const rl = rateLimit(req, "github-workflow-runs");
    if (rl) return rl;

    const raw = await req.text();
    let body: any = {};
    if (raw?.trim()) {
      try {
        body = JSON.parse(raw);
      } catch {
        return new Response(
          JSON.stringify({ ok: false, error: "Invalid JSON body" }),
          {
            status: 400,
            headers: { ...responseCorsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    const githubRepo =
      body.githubRepo ??
      body.github_repo ??
      body.repoFullName ??
      body.fullName ??
      body.repository ??
      body.githubRepository ??
      (body.owner && body.repo ? `${body.owner}/${body.repo}` : "");

    if (!githubRepo || typeof githubRepo !== "string" || !githubRepo.includes("/")) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing/invalid githubRepo" }),
        {
          status: 400,
          headers: { ...responseCorsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const workflowIdRaw =
      body.workflowId ??
      body.workflow_id ??
      body.workflowFile ??
      body.workflow_file ??
      body.workflow ??
      body.path ??
      "";

    const workflowId = (typeof workflowIdRaw === "string" ? workflowIdRaw : "").trim();

    const perPageRaw = body.perPage ?? body.per_page ?? 20;
    const perPage = Math.max(1, Math.min(100, Number(perPageRaw) || 20));

    const ref = (body.ref ?? body.branch ?? "").toString().trim();
    const status = (body.status ?? "").toString().trim();
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

    let json: any;
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
  } catch (e) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Unexpected error",
        message: sanitizeErrorText(e?.message ?? String(e)),
      }),
      {
        status: 500,
        headers: { ...responseCorsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
