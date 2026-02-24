import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { GITHUB_API_BASE } from "../../../shared/constants/github.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAdminKey, rateLimit } from "../_shared/auth.ts";
import { githubHeaders, getGithubToken } from "../_shared/github.ts";
import { sanitizeErrorText, sanitizeGitHubFailure } from "../_shared/errorSanitization.ts";
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

    const { githubRepo, workflow, ref, inputs, githubToken } = val.data!;
    // Prefer server-side secret; optionally allow a caller-provided token as fallback.
    const token = (getGithubToken() || githubToken || "").trim();

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

const body = { ref, inputs: inputs ?? {} };

// `workflow` can be id, filename, or a short alias. Some repos don’t have the CI Lite workflows yet.
// Try a few candidates before failing.
const candidates: string[] = [];
const w = (workflow ?? "").trim();
if (w) candidates.push(w);
if (w && !w.includes(".") && !/^[0-9]+$/.test(w)) {
  candidates.push(`${w}.yml`);
  candidates.push(`${w}.yaml`);
}

let lastResp: Response | null = null;
for (const wf of candidates) {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/workflows/${wf}/dispatches`;
  const r = await fetch(url, {
    method: "POST",
    headers: githubHeaders(token),
    body: JSON.stringify(body),
  });
  if (r.ok) {
    return jsonResponse({ ok: true, workflow: wf }, req, 200);
  }
  lastResp = r;
  // Only retry on workflow-not-found.
  if (r.status !== 404) break;
}

// If still not ok, bubble the last response.
const r = lastResp!;
if (!r.ok) {
      const txt = await r.text();
      return errorResponse(
        "GitHub workflow dispatch failed",
        req,
        502,
        sanitizeGitHubFailure(r, txt),
      );
    }

    return jsonResponse({ ok: true }, req, 200);
  } catch (e) {
    return errorResponse("Unexpected error", req, 500, {
      message: sanitizeErrorText(e?.message ?? String(e)),
    });
  }
});
