import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAdminKey, rateLimit } from "../_shared/auth.ts";
import {
  parseJsonBody,
  validateGitHubRepo,
  sanitizeString,
} from "../_shared/validation.ts";
import { githubHeaders } from "../_shared/github.ts";

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
    const body = await parseJsonBody(req, 30 * 1024); // 30 KiB
    if (!body || typeof body !== "object") {
      return errorResponse("Invalid JSON body", req, 400, {
        error: "Body must be an object",
      });
    }
    const obj = body as Record<string, unknown>;

    const repoV = validateGitHubRepo(obj.githubRepo);
    if (!repoV.valid) {
      return errorResponse("Validation failed", req, 400, {
        error: repoV.error,
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
