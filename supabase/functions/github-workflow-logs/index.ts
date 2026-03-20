// supabase/functions/github-workflow-logs/index.ts
// REFACTORED: helpers → helpers.ts

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { requireAdminKeyOrServiceRoleBearer, rateLimit } from "../_shared/auth.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import { getGithubToken, githubHeaders, GITHUB_API_BASE } from "../_shared/github.ts";
import { sanitizeErrorText, sanitizeGitHubFailure } from "../_shared/errorSanitization.ts";
import {
  jsonOk, jsonErr, asString, asNumber, parseGithubRepo,
  redactSecrets, fetchLogsZip, zipToText, MAX_CHARS, MAX_ZIP_BYTES,
} from "./helpers.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = requireAdminKeyOrServiceRoleBearer(req);
    if (auth) return auth;

    const rl = rateLimit(req, "github-workflow-logs", 60, 60_000);
    if (rl) return rl;

    const parsedBody = await parseJsonBody(req, 50_000);
    if (!parsedBody.ok) {
      const status = parsedBody.error.includes("too large") ? 413 : 400;
      return jsonErr(req, "Validation failed", { error: parsedBody.error }, status);
    }
    const body = parsedBody.body as Json;

    const tokenFromBody = String(
      (body as any).githubToken ?? (body as any).ghToken ?? (body as any).token ?? (body as any).github_token ?? "",
    ).trim();

    const repoObj = parseGithubRepo(body.githubRepo);
    if (!repoObj) {
      return jsonErr(
        req,
        "Validation failed",
        { error: "githubRepo must be 'owner/repo' string" },
        400,
      );
    }

    const runId =
      asNumber(body.runId) ??
      (typeof body.runId === "string" ? Number(body.runId) : undefined) ??
      asNumber(body.run_id) ??
      (typeof body.run_id === "string" ? Number(body.run_id) : undefined);

    if (!runId || !Number.isFinite(runId)) {
      return jsonErr(
        req,
        "Validation failed",
        { error: "runId must be a number" },
        400,
      );
    }

    const token = (tokenFromBody || getGithubToken() || "").trim();
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
      const runMetaRes = await fetch(runMetaUrl, { method: "GET", headers: githubHeaders(token, "Bearer") });
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
          id: Math.trunc(runId) as Json,
          status: null,
          conclusion: null,
          html_url: null,
          name: null,
          event: null,
          created_at: null,
          updated_at: null,
          meta_error: sanitizeGitHubFailure(runMetaTxt) as Json,
        };
      }
    } catch {
      run = null;
    }

    const zipBytes = await fetchLogsZip(
      repoObj.owner,
      repoObj.repo,
      Math.trunc(runId),
      token,
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
      githubRepo: `${repoObj.owner}/${repoObj.repo}`,
      runId: Math.trunc(runId),
      run,
      fileCount: parsed.fileCount,
      files: parsed.files,
      truncated,
      logsText: text,
    });
  } catch (e) {
    const anyE = e as any;
    // Handle "not ready" signals from fetchLogsZip (logs still being prepared)
    if (anyE && anyE.notReady === true && anyE.body) {
      return jsonOk(req, anyE.body, anyE.status ?? 200);
    }
    if (anyE && typeof anyE.status === "number") {
      return jsonErr(
        req,
        "GitHub workflow logs fetch failed",
        { status: anyE.status, body: anyE.body ?? "" },
        502,
      );
    }
    return jsonErr(
      req,
      "Internal error",
      { message: String(anyE?.message ?? e), code: anyE?.code },
      500,
    );
  }
});
