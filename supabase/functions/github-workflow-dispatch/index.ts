import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAdminKey, rateLimit } from "../_shared/auth.ts";
import { githubHeaders, getGithubToken } from "../_shared/github.ts";
import {
  parseJsonBody,
  validateGithubWorkflowDispatchRequest,
} from "../_shared/validation.ts";

function parseCsvEnv(name: string): string[] {
  const raw = (Deno.env.get(name) ?? "").trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function isAllowedRepo(repo: string): boolean {
  const allow = parseCsvEnv("K1W1_ALLOWED_GITHUB_REPOS");
  if (allow.length === 0) return true; // rollout mode
  return allow.includes(repo);
}

function isAllowedRef(ref: string): boolean {
  const r = (ref ?? "").trim();
  if (!r) return true;
  if (r.startsWith("refs/")) return false;
  if (/^[0-9a-f]{40}$/i.test(r)) return false;

  const regexStr = (Deno.env.get("K1W1_ALLOWED_REF_REGEX") ?? "").trim();
  if (!regexStr) return true; // rollout mode
  try {
    const re = new RegExp(regexStr);
    return re.test(r);
  } catch {
    return false;
  }
}

/**
 * Dispatches a GitHub Actions workflow via workflow_dispatch.
 *
 * Expected input:
 * {
 *   githubRepo: "owner/repo",
 *   workflow: "file.yml" (or workflow_id),
 *   ref: "branch",
 *   inputs?: object
 * }
 */
serve(async (req) => {
  if (handleCors(req)) return handleCors(req);

  try {
    const auth = requireAdminKey(req);
    if (auth) return auth;

    const rl = rateLimit(req, "github-workflow-dispatch");
    if (rl) return rl;

    const parsed = await parseJsonBody(req, 200_000);
    if (!parsed.ok) return errorResponse(parsed.error, req, 400);

    const val = validateGithubWorkflowDispatchRequest(parsed.body);
    if (!val.ok) return errorResponse("Invalid request", req, 400, val.errors);

    const { githubRepo, workflow, ref, inputs } = val.data!;
    const token = getGithubToken();

    if (!token) {
      return errorResponse("Missing GitHub token", req, 500, {
        expected: ["GITHUB_TOKEN", "GH_TOKEN", "GITHUB_API_TOKEN"],
      });
    }

    if (!isAllowedRepo(githubRepo)) {
      return jsonResponse(
        { ok: false, error: "githubRepo not allowed", details: { githubRepo } },
        req,
        403,
      );
    }

    if (!isAllowedRef(ref)) {
      return jsonResponse({ ok: false, error: "ref not allowed", details: { ref } }, req, 403);
    }

    const [owner, repo] = githubRepo.split("/");

    const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`;
    const body = { ref, inputs: inputs ?? {} };

    const r = await fetch(url, {
      method: "POST",
      headers: githubHeaders(token),
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const txt = await r.text();
      return errorResponse("GitHub workflow dispatch failed", req, 502, {
        status: r.status,
        body: txt.slice(0, 4000),
        url,
      });
    }

    return jsonResponse({ ok: true }, req, 200);
  } catch (e) {
    return errorResponse("Unexpected error", req, 500, {
      message: e?.message ?? String(e),
    });
  }
});
