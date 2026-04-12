// supabase/functions/github-workflow-logs/index.ts
// REFACTORED: helpers → helpers.ts

import { handleCors } from "../_shared/cors.ts";
import {
  getRequestRateLimitSubject,
  requireDurableRateLimit,
  requireWorkflowOperatorJwtRole,
  requireScopedEdgeAuth,
  rateLimit,
} from "../_shared/auth.ts";
import { isParsedJsonBodyError, parseJsonBody } from "../_shared/validation.ts";
import { getGithubToken, githubFetch, GITHUB_API_BASE, isAllowedGithubRepo } from "../_shared/github.ts";
import { sanitizeGitHubFailure } from "../_shared/errorSanitization.ts";
import {
  jsonOk, jsonErr, asNumber, parseGithubRepo, type Json,
  redactSecrets, fetchLogsZip, zipToText, MAX_CHARS, classifyWorkflowLogsErrorStatus,
} from "./helpers.ts";

type NotReadyPayload = { ok: false; reason: string; status?: string };

function asErrorLike(input: unknown): {
  status?: number;
  body?: string | NotReadyPayload;
  code?: string;
  message?: string;
  notReady?: boolean;
} {
  if (!input || typeof input !== "object") return {};
  const record = input as Record<string, unknown>;
  return {
    status: typeof record.status === "number" ? record.status : undefined,
    body:
      typeof record.body === "string" ||
        (record.body && typeof record.body === "object")
        ? (record.body as string | NotReadyPayload)
        : undefined,
    code: typeof record.code === "string" ? record.code : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
    notReady: record.notReady === true,
  };
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // Legacy guard lineage: generic admin-or-CI bearer guard (removed).
    const auth = requireScopedEdgeAuth(req, {
      scope: "github-workflow-logs",
      allowAdmin: true,
      adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY",
    });
    if (auth) return auth;
    const jwtRoleGuard = await requireWorkflowOperatorJwtRole(req, "github-workflow-logs");
    if (jwtRoleGuard) return jwtRoleGuard;

    const durableRl = await requireDurableRateLimit(req, {
      scope: "github-workflow-logs",
      subject: getRequestRateLimitSubject(req),
      max: 60,
      windowMs: 60_000,
    });
    if (durableRl) return durableRl;

    const rl = rateLimit(req, "github-workflow-logs", 60, 60_000);
    if (rl) return rl;

    const parsedBody = await parseJsonBody(req, 50_000);
    if (isParsedJsonBodyError(parsedBody)) {
      const parseError = parsedBody.error;
      const status = parseError.includes("too large") ? 413 : 400;
      return jsonErr(req, "Validation failed", { error: parseError }, status);
    }
    const body = parsedBody.body as Json;
    const repoObj = parseGithubRepo(body.githubRepo);
    if (!repoObj) {
      return jsonErr(
        req,
        "Validation failed",
        { error: "githubRepo must be 'owner/repo' string" },
        400,
      );
    }

    const normalizedGithubRepo = `${repoObj.owner}/${repoObj.repo}`;
    if (!isAllowedGithubRepo(normalizedGithubRepo)) {
      return jsonErr(
        req,
        "githubRepo not allowed",
        { githubRepo: normalizedGithubRepo },
        403,
      );
    }

    const runIdRaw =
      asNumber(body.runId) ??
      (typeof body.runId === "string" ? Number(body.runId) : undefined) ??
      asNumber(body.run_id) ??
      (typeof body.run_id === "string" ? Number(body.run_id) : undefined);

    const runId = Number.isInteger(runIdRaw) && Number(runIdRaw) > 0
      ? Number(runIdRaw)
      : null;

    if (runId === null) {
      return jsonErr(
        req,
        "Validation failed",
        { error: "runId must be a positive integer" },
        400,
      );
    }

    const token = getGithubToken().trim();
    if (!token) {
      return jsonErr(
        req,
        "Missing GitHub token",
        { expected: ["GITHUB_TOKEN", "GH_TOKEN", "GITHUB_API_TOKEN"] },
        500,
      );
    }

    // Best-effort run metadata so UI can reflect real red/green reliably.
    let run: Record<string, Json> | null = null;
    try {
      const runMetaUrl = `${GITHUB_API_BASE}/repos/${repoObj.owner}/${repoObj.repo}/actions/runs/${Math.trunc(runId)}`;
      const runMetaRes = await githubFetch(runMetaUrl, { method: "GET" });
      const runMetaTxt = await runMetaRes.text();
      if (runMetaRes.ok) {
        const raw = JSON.parse(runMetaTxt);
        run = {
          id: (raw?.id ?? Math.trunc(runId)) as Json,
          status: (raw?.status ?? null) as Json,
          conclusion: (raw?.conclusion ?? null) as Json,
          html_url: (raw?.html_url ?? null) as Json,
          name: (raw?.name ?? null) as Json,
          event: (raw?.event ?? null) as Json,
          created_at: (raw?.created_at ?? null) as Json,
          updated_at: (raw?.updated_at ?? null) as Json,
        };
      } else {
        run = {
          id: Math.trunc(runId) as unknown as Json,
          status: null,
          conclusion: null,
          html_url: null,
          name: null,
          event: null,
          created_at: null,
          updated_at: null,
          meta_error: sanitizeGitHubFailure(runMetaRes, runMetaTxt) as Json,
        };
      }
    } catch {
      run = null;
    }

    const zipBytes = await fetchLogsZip(
      repoObj.owner,
      repoObj.repo,
      Math.trunc(runId),
    );
    const parsed = zipToText(zipBytes);

    let text = redactSecrets(parsed.text);
    let truncated = false;
    if (text.length > MAX_CHARS) {
      truncated = true;
      text = text.slice(0, MAX_CHARS) + "\n\n<...truncated...>";
    }

    return jsonOk(req, {
      ok: true,
      githubRepo: normalizedGithubRepo,
      runId: Math.trunc(runId),
      run,
      fileCount: parsed.fileCount,
      files: parsed.files,
      truncated,
      logsText: text,
    });
  } catch (e) {
    const errorLike = asErrorLike(e);
    // Handle "not ready" signals from fetchLogsZip (logs still being prepared)
    if (errorLike.notReady === true && errorLike.body) {
      return jsonOk(req, errorLike.body, errorLike.status ?? 200);
    }
    if (typeof errorLike.status === "number") {
      const classified = classifyWorkflowLogsErrorStatus(errorLike.status);
      return jsonErr(
        req,
        classified.error,
        {
          code: classified.code,
          upstream_status: errorLike.status,
          body: errorLike.body ?? "",
        },
        classified.status,
      );
    }
    return jsonErr(
      req,
      "Internal error",
      { message: String(errorLike.message ?? e), code: errorLike.code },
      500,
    );
  }
});
