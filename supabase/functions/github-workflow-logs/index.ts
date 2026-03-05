// supabase/functions/github-workflow-logs/index.ts
// REFACTORED: helpers → helpers.ts

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  jsonOk, jsonErr, asString, asNumber, parseGithubRepo,
  redactSecrets, fetchLogsZip, zipToText, MAX_CHARS, MAX_ZIP_BYTES,
} from "./helpers.ts";

import { handleCors } from "../_shared/cors.ts";
import { requireAdminKey, rateLimit } from "../_shared/auth.ts";
import { parseJsonBody } from "../_shared/validation.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = requireAdminKey(req);
    if (auth) return auth;

    const rl = rateLimit(req, "github-workflow-logs", 60, 60_000);
    if (rl) return rl;

    const parsedBody = await parseJsonBody(req, 50_000);
    if (!parsedBody.ok) {
      const status = parsedBody.error.includes("too large") ? 413 : 400;
      return jsonErr("Validation failed", { error: parsedBody.error }, status);
    }
    const body = parsedBody.body as Json;

    const tokenFromBody = String(
      (body as any).githubToken ?? (body as any).ghToken ?? (body as any).token ?? (body as any).github_token ?? "",
    ).trim();

    const repoObj = parseGithubRepo(body.githubRepo);
    if (!repoObj) {
      return jsonErr(
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
        "Validation failed",
        { error: "runId must be a number" },
        400,
      );
    }

    const zipBytes = await fetchLogsZip(
      repoObj.owner,
      repoObj.repo,
      Math.trunc(runId),
      tokenFromBody || undefined,
    );
    const parsed = zipToText(zipBytes);

    let text = redactSecrets(parsed.text);
    let truncated = false;
    if (text.length > MAX_CHARS) {
      truncated = true;
      text = text.slice(0, MAX_CHARS) + "\n\n<...truncated...>";
    }

    return jsonOk({
      ok: true,
      githubRepo: `${repoObj.owner}/${repoObj.repo}`,
      runId: Math.trunc(runId),
      fileCount: parsed.fileCount,
      files: parsed.files,
      truncated,
      logsText: text,
    });
  } catch (e: unknown) {
    const anyE = e as any;
    // Handle "not ready" signals from fetchLogsZip (logs still being prepared)
    if (anyE && anyE.notReady === true && anyE.body) {
      return jsonOk(anyE.body, anyE.status ?? 200);
    }
    if (anyE && typeof anyE.status === "number") {
      return jsonErr(
        "GitHub workflow logs fetch failed",
        { status: anyE.status, body: anyE.body ?? "" },
        502,
      );
    }
    return jsonErr(
      "Internal error",
      { message: String(anyE?.message ?? e), code: anyE?.code },
      500,
    );
  }
});