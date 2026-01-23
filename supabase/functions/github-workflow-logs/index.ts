/**
 * Supabase Edge Function: github-workflow-logs
 *
 * Fetches GitHub Actions run logs (zip) and returns a sanitized text output.
 * - Requires x-k1w1-admin-key header (K1W1_EDGE_ADMIN_KEY)
 * - Uses GITHUB_TOKEN (fine-grained PAT supported)
 * - Accepts githubRepo like "owner/repo" and runId
 *
 * Response is intentionally minimized & sanitized to avoid leaking huge GitHub objects.
 */
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAdminKey, rateLimit } from "../_shared/auth.ts";
import { githubHeaders } from "../_shared/github.ts";
import { unzipSync, strFromU8 } from "https://deno.land/x/fflate@0.8.2/mod.ts";

type Json = Record<string, unknown>;

function jsonOk(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function jsonErr(error: string, details?: unknown, status = 400) {
  return jsonOk({ ok: false, error, details }, status);
}

function safeJson(req: Request): Promise<Json> {
  return req
    .json()
    .then((v) => (v && typeof v === "object" ? (v as Json) : {}))
    .catch(() => ({}));
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function parseGithubRepo(v: unknown): { owner: string; repo: string } | null {
  const s = (asString(v) ?? "").trim();
  const m = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(s);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

function redactSecrets(text: string): string {
  // Basic redaction: emails + obvious token patterns.
  // Keep it conservative to avoid destroying useful logs.
  const t1 = text.replace(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    "<redacted-email>",
  );
  const t2 = t1.replace(
    /\b(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
    "<redacted-token>",
  );
  return t2;
}

async function fetchLogsZip(
  owner: string,
  repo: string,
  runId: number,
): Promise<Uint8Array> {
  const api = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/logs`;

  // First request: get the signed URL (302 Location).
  const r1 = await fetch(api, {
    method: "GET",
    headers: githubHeaders(undefined, "Bearer"),
    redirect: "manual",
  });

  if (r1.status !== 302) {
    const body = await r1.text().catch(() => "");
    throw { status: r1.status, body };
  }

  const loc = r1.headers.get("location") || r1.headers.get("Location");
  if (!loc)
    throw { status: 502, body: "Missing redirect location for logs zip" };

  // Second request: download zip from signed URL (no auth header).
  const r2 = await fetch(loc, { method: "GET" });
  if (!r2.ok) {
    const body = await r2.text().catch(() => "");
    throw { status: r2.status, body };
  }
  return new Uint8Array(await r2.arrayBuffer());
}

function zipToText(zipBytes: Uint8Array): {
  fileCount: number;
  files: string[];
  text: string;
} {
  const out = unzipSync(zipBytes);
  const files = Object.keys(out).sort();
  const parts: string[] = [];
  for (const name of files) {
    const bytes = out[name];
    const chunk = strFromU8(bytes);
    parts.push(`\n===== ${name} =====\n`);
    parts.push(chunk);
  }
  return { fileCount: files.length, files, text: parts.join("") };
}

const MAX_CHARS = 200_000; // keep responses sane

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    rateLimit(req, { limit: 60, windowMs: 60_000 });
    requireAdminKey(req);

    const body = await safeJson(req);

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
  } catch (e) {
    const anyE = e as any;
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
