import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAdminKey, rateLimit } from "../_shared/auth.ts";
import {
  parseJsonBody,
  validateTriggerBuildRequest,
} from "../_shared/validation.ts";
import { githubHeaders, getGithubToken } from "../_shared/github.ts";
import { sanitizeErrorText, sanitizeGitHubFailure } from "../_shared/errorSanitization.ts";
import { GITHUB_API_BASE } from "../../../shared/constants/github.ts";

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

function isAllowedRef(ref: string | null | undefined): boolean {
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
 * Creates a build_jobs row and triggers the GitHub repository_dispatch event (trigger-eas-build).
 *
 * Contract:
 * - Input: { githubRepo, buildProfile, branch? }
 * - Output: { ok: true, jobId, githubRepo, branch, buildProfile }
 */
serve(async (req) => {
    const cors = handleCors(req);
  if (cors) return cors;
try {
    const auth = requireAdminKey(req);
    if (auth) return auth;

    const rl = rateLimit(req, "trigger-eas-build");
    if (rl) return rl;

    const parsed = await parseJsonBody(req, 200_000);
    if (!parsed.ok) {
      return errorResponse(parsed.error, req, 400);
    }

    const validation = validateTriggerBuildRequest(parsed.body);
    if (!validation.ok) {
      return errorResponse("Invalid request", req, 400, validation.errors);
    }

    const SUPABASE_URL = Deno.env.get("K1W1_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE =
      Deno.env.get("K1W1_SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const GITHUB_TOKEN = getGithubToken();

    if (!SUPABASE_URL || !SERVICE_ROLE || !GITHUB_TOKEN) {
      return errorResponse("Missing required server env", req, 500, {
        SUPABASE_URL: !!SUPABASE_URL,
        SERVICE_ROLE: !!SERVICE_ROLE,
        GITHUB_TOKEN: !!GITHUB_TOKEN,
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { githubRepo, buildProfile, branch } = validation.data!;

    if (!isAllowedRepo(githubRepo)) {
      return errorResponse("githubRepo not allowed", req, 403, { githubRepo });
    }

    if (!isAllowedRef(branch ?? null)) {
      return errorResponse("branch/ref not allowed", req, 403, { branch: branch ?? null });
    }

    // Create job row
    const insertRes = await supabase
      .from("build_jobs")
      .insert({
        status: "queued",
        github_repo: githubRepo,
        build_profile: buildProfile,
        branch: branch ?? null,
      })
      .select("id")
      .single();

    if (insertRes.error) {
      return errorResponse("Failed to create build job", req, 500, {
        message: sanitizeErrorText(insertRes.error.message),
        code: insertRes.error.code,
      });
    }

    const jobId = insertRes.data.id;

    const [owner, repo] = githubRepo.split("/");
    const payload = {
      event_type: "trigger-eas-build",
      client_payload: {
        github_repo: githubRepo,
        repo: githubRepo,
        branch: branch ?? null,
        ref: branch ?? null,
        build_profile: buildProfile,
        buildProfile: buildProfile,
        job_id: jobId,
      },
    };

    const r = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/dispatches`, {
      method: "POST",
      headers: githubHeaders(GITHUB_TOKEN),
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const txt = await r.text();
      return errorResponse("GitHub dispatch failed", req, 502, sanitizeGitHubFailure(r, txt));
    }

    return jsonResponse(
      {
        ok: true,
        jobId,
        githubRepo,
        branch: branch ?? null,
        buildProfile,
      },
      req,
      200,
    );
  } catch (e) {
    return errorResponse("Unexpected error", req, 500, {
      message: sanitizeErrorText(e?.message ?? String(e)),
    });
  }
});
