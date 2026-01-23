import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAdminKey, rateLimit } from "../_shared/auth.ts";
import { validateGitHubRepo, sanitizeString } from "../_shared/validation.ts";
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

/**
 * Fetches recent GitHub Actions workflow runs for a repository.
 * Intended for the in-app logs/diagnostics viewer.
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const auth = requireAdminKey(req);
  if (auth) return auth;

  const rl = rateLimit(req, "github-workflow-runs");
  if (rl) return rl;

  try {
    const obj = await readJsonObject(req, 32 * 1024);
    if (!obj) {
      return errorResponse("Invalid JSON body", req, 400, {
        error: "Body must be a JSON object (<= 32 KiB)",
      });
    }

    const githubRepo = pickGitHubRepo(obj) ?? (obj as any).githubRepo;
    const repoV = validateGitHubRepo(githubRepo);
    if (!repoV.valid) {
      return errorResponse("Validation failed", req, 400, {
        error: repoV.error,
        receivedType: typeof (obj as any).githubRepo,
        keys: Object.keys(obj).slice(0, 25),
      });
    }

    const perPageV = sanitizeString(obj.perPage, 4);
    let perPage = 20;
    if (perPageV.valid && perPageV.value) {
      const n = Number.parseInt(perPageV.value, 10);
      if (Number.isFinite(n) && n >= 1 && n <= 50) perPage = n;
    }

    const workflowV = sanitizeString(obj.workflowFile, 200);
    const workflowFile = workflowV.valid
      ? workflowV.value || undefined
      : undefined;

    const branchV = sanitizeString(obj.branch, 200);
    const branch = branchV.valid ? branchV.value || undefined : undefined;

    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
    if (!GITHUB_TOKEN) {
      return errorResponse("Missing required environment variables", req, 500, {
        missing: { GITHUB_TOKEN: false },
      });
    }

    let url = `https://api.github.com/repos/${repoV.value}/actions/runs?per_page=${perPage}`;
    // Optional filters
    if (branch) url += `&branch=${encodeURIComponent(branch)}`;

    // If workflowFile provided, use workflow runs endpoint for that workflow file/name/id
    if (workflowFile) {
      url = `https://api.github.com/repos/${repoV.value}/actions/workflows/${workflowFile}/runs?per_page=${perPage}`;
      if (branch) url += `&branch=${encodeURIComponent(branch)}`;
    }

    const res = await fetch(url, { headers: githubHeaders(GITHUB_TOKEN) });
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      return errorResponse("GitHub runs fetch failed", req, res.status, {
        status: res.status,
        body: errorText,
      });
    }

    const data = await res.json().catch(() => null);
    return jsonResponse({ ok: true, data }, req, 200);
  } catch (err: any) {
    console.error(
      "❌ github-workflow-runs error",
      err?.message ?? err,
      err?.stack,
    );
    return errorResponse(
      "Unhandled exception in github-workflow-runs",
      req,
      500,
      {
        message: err?.message || "Unknown error",
      },
    );
  }
});
