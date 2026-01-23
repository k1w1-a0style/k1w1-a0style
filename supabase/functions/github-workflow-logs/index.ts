import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAdminKey, rateLimit } from "../_shared/auth.ts";
import { validateGitHubRepo, validateRunId } from "../_shared/validation.ts";
import { githubHeaders } from "../_shared/github.ts";

type JsonObj = Record<string, unknown>;

async function readJsonObject(
  req: Request,
  maxBytes: number,
): Promise<JsonObj | null> {
  const raw = await req.text();
  if (raw.length > maxBytes) return null;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as JsonObj;
  } catch {
    return null;
  }
}

function pickString(obj: JsonObj, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

function pickGitHubRepo(obj: JsonObj): string | undefined {
  const direct = pickString(obj, "githubRepo", "github_repo", "repoFullName");
  if (direct) return direct;
  const owner = pickString(obj, "owner", "githubOwner");
  const repo = pickString(obj, "repo", "githubRepoName");
  if (owner && repo) return `${owner}/${repo}`;
  return undefined;
}
import { unzipSync, strFromU8 } from "npm:fflate@0.8.2";

const MAX_LOG_ZIP_BYTES = 15 * 1024 * 1024; // 15 MiB (compressed)
const MAX_LOG_UNZIPPED_BYTES = 50 * 1024 * 1024; // 50 MiB (uncompressed)
const MAX_LOG_FILES = 2000;

/**
 * Fetches GitHub Actions workflow logs.
 * - Downloads the log ZIP from GitHub, unzips with strict limits
 * - Returns structured log chunks for the app UI
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const auth = requireAdminKey(req);
  if (auth) return auth;

  const rl = rateLimit(req, "github-workflow-logs");
  if (rl) return rl;

  try {
    const obj = await readJsonObject(req, 64 * 1024);
    if (!obj) {
      return errorResponse("Invalid JSON body", req, 400, {
        error: "Body must be a JSON object (<= 64 KiB)",
      });
    }

    const githubRepo = pickGitHubRepo(obj) ?? (obj as any).githubRepo;
    const repoV = validateGitHubRepo(githubRepo);
    const runV = validateRunId(obj.runId);

    if (!repoV.valid || !runV.valid || !runV.value) {
      return errorResponse("Validation failed", req, 400, {
        errors: [repoV.error, runV.error].filter(Boolean),
      });
    }

    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
    if (!GITHUB_TOKEN) {
      return errorResponse("Missing required environment variables", req, 500, {
        missing: { GITHUB_TOKEN: false },
      });
    }

    const githubRepo = repoV.value!;
    const runId = runV.value!;

    // 1) Fetch workflow run details to get logs URL and metadata
    const runUrl = `https://api.github.com/repos/${githubRepo}/actions/runs/${runId}`;
    const runResponse = await fetch(runUrl, {
      headers: githubHeaders(GITHUB_TOKEN),
    });

    if (!runResponse.ok) {
      const errorText = await runResponse.text().catch(() => "");
      return errorResponse(
        "Failed to fetch workflow run",
        req,
        runResponse.status,
        {
          status: runResponse.status,
          body: errorText,
        },
      );
    }

    const runData = await runResponse.json();
    const logsUrl = runData?.logs_url;
    if (!logsUrl || typeof logsUrl !== "string") {
      return errorResponse("Workflow run logs_url missing", req, 500, {
        runId,
      });
    }

    // 2) Download ZIP
    const logsResponse = await fetch(logsUrl, {
      headers: githubHeaders(GITHUB_TOKEN, {
        Accept: "application/vnd.github+json",
      }),
    });

    if (!logsResponse.ok) {
      const errorText = await logsResponse.text().catch(() => "");
      return errorResponse(
        "Failed to fetch logs ZIP",
        req,
        logsResponse.status,
        {
          status: logsResponse.status,
          body: errorText,
        },
      );
    }

    const buf = new Uint8Array(await logsResponse.arrayBuffer());
    if (buf.byteLength > MAX_LOG_ZIP_BYTES) {
      return errorResponse("Logs ZIP too large", req, 413, {
        maxBytes: MAX_LOG_ZIP_BYTES,
        gotBytes: buf.byteLength,
      });
    }

    // 3) Unzip with limits
    const files = unzipSync(buf, {
      filter: (file) =>
        file.name.endsWith(".txt") || file.name.endsWith(".log"),
    });

    const outFiles: { name: string; text: string }[] = [];
    let totalUnzipped = 0;
    let count = 0;

    for (const [name, data] of Object.entries(files)) {
      count++;
      if (count > MAX_LOG_FILES) break;

      const bytes = (data as Uint8Array).byteLength;
      totalUnzipped += bytes;
      if (totalUnzipped > MAX_LOG_UNZIPPED_BYTES) break;

      outFiles.push({ name, text: strFromU8(data as Uint8Array) });
    }

    return jsonResponse(
      {
        ok: true,
        repo: githubRepo,
        runId,
        meta: {
          zipBytes: buf.byteLength,
          unzippedBytes: totalUnzipped,
          files: outFiles.length,
        },
        files: outFiles,
      },
      req,
      200,
    );
  } catch (err: any) {
    console.error(
      "❌ github-workflow-logs error",
      err?.message ?? err,
      err?.stack,
    );
    return errorResponse(
      "Unhandled exception in github-workflow-logs",
      req,
      500,
      {
        message: err?.message || "Unknown error",
      },
    );
  }
});
