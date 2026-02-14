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
import { parseJsonBody } from "../_shared/validation.ts";
import { githubHeaders } from "../_shared/github.ts";
import { unzipSync, strFromU8 } from "npm:fflate@0.8.2";

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

function isPrivateIp(hostname: string): boolean {
  // IPv4 only best-effort
  const m = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const o = m.slice(1).map((x) => Number(x));
  if (o.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return false;
  const [a, b] = o;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function assertAllowedRedirect(urlStr: string): URL {
  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    throw { status: 400, body: "Invalid redirect URL for logs zip" };
  }

  if (u.protocol !== "https:") {
    throw { status: 400, body: "Logs redirect must be https" };
  }

  const host = u.hostname.toLowerCase();
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".local") ||
    isPrivateIp(host)
  ) {
    throw { status: 400, body: "Disallowed logs redirect host" };
  }

  // GitHub logs redirects typically point to GitHub/Azure/AWS controlled hosts.
  // We allow a conservative set of suffixes to reduce SSRF risk without breaking normal runs.
  const allowedSuffixes = [
    "github.com",
    "githubusercontent.com",
    "actions.githubusercontent.com",
    "pipelines.actions.githubusercontent.com",
    "blob.core.windows.net",
    "amazonaws.com",
  ];

  if (!allowedSuffixes.some((s) => host === s || host.endsWith("." + s))) {
    throw { status: 400, body: "Logs redirect host not allowed" };
  }

  return u;
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
    // GitHub returns 404 in two common cases:
    // 1) Logs are not ready yet (run still in_progress/queued)
    // 2) The token has no access to Actions/logs (private repo) OR runId is invalid
    if (r1.status === 404) {
      const runApi = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`;
      const rr = await fetch(runApi, {
        method: "GET",
        headers: githubHeaders(undefined, "Bearer"),
      });

      if (rr.status === 200) {
        let runJson: any = null;
        try {
          runJson = await rr.json();
        } catch {
          runJson = null;
        }

        const runStatus = String(runJson?.status ?? "");
        const runConclusion = runJson?.conclusion != null ? String(runJson.conclusion) : null;

        // If the run is still executing, logs zip may not exist yet.
        if (runStatus && runStatus !== "completed") {
          throw {
            status: 200,
            notReady: true,
            body: {
              ok: true,
              status: "not_ready",
              runStatus,
              runConclusion,
              retryAfterMs: 5000,
              message: "Logs not ready (run still in progress).",
            },
          };
        }

        // Completed but logs endpoint still 404 – treat as transient.
        throw {
          status: 200,
          notReady: true,
          body: {
            ok: true,
            status: "not_ready",
            runStatus: runStatus || "completed",
            runConclusion,
            retryAfterMs: 8000,
            message: "Logs not found yet (GitHub may still be preparing the archive).",
          },
        };
      }

      // If the run itself is 404, it's likely an invalid runId or missing permissions.
      const body = await r1.text().catch(() => "");
      throw {
        status: 404,
        body:
          body ||
          "GitHub returned 404. Hint: ensure you pass a workflow *run id* (not run number) and the token has Actions read access for this repo.",
      };
    }

    const body = await r1.text().catch(() => "");
    throw { status: r1.status, body };
  }

  const loc = r1.headers.get("location") || r1.headers.get("Location");
  if (!loc)
    throw { status: 502, body: "Missing redirect location for logs zip" };

  const safeLoc = assertAllowedRedirect(loc).toString();

  // Second request: download zip from signed URL (no auth header).
  const r2 = await fetch(safeLoc, { method: "GET" });
  if (!r2.ok) {
    const body = await r2.text().catch(() => "");
    throw { status: r2.status, body };
  }
  const len2 = r2.headers.get("content-length");
  if (len2) {
    const n = Number(len2);
    if (Number.isFinite(n) && n > MAX_ZIP_BYTES) {
      throw { status: 413, body: `Logs zip too large (${n} bytes)` };
    }
  }

  const reader = r2.body?.getReader?.();
  if (!reader) {
    const buf = await r2.arrayBuffer();
    if (buf.byteLength > MAX_ZIP_BYTES) {
      throw {
        status: 413,
        body: `Logs zip too large (${buf.byteLength} bytes)`,
      };
    }
    return new Uint8Array(buf);
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_ZIP_BYTES) {
      try {
        reader.cancel?.();
      } catch {
        // ignore
      }
      throw { status: 413, body: `Logs zip too large (${total} bytes)` };
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    merged.set(c, off);
    off += c.byteLength;
  }
  return merged;
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
const MAX_ZIP_BYTES = 25_000_000; // avoid huge downloads / zip bombs

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
