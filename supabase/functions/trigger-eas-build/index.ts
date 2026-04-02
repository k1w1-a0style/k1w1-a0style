import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import {
  getRuntimeEnv,
  getRequestRateLimitSubject,
  getServiceRoleKey,
  getSupabaseUrl,
  requireWorkflowOperatorJwtRole,
  requireScopedEdgeAuth,
  rateLimit,
  requireDurableRateLimit,
} from "../_shared/auth.ts";
import {
  isParsedJsonBodyError,
  parseJsonBody,
  validateTriggerBuildRequest,
} from "../_shared/validation.ts";
import { githubFetch, getGithubToken, GITHUB_API_BASE, isAllowedGithubRepo } from "../_shared/github.ts";
import { sanitizeErrorText, sanitizeGitHubFailure } from "../_shared/errorSanitization.ts";

function isAllowedRef(ref: string | null | undefined): boolean {
  const r = (ref ?? "").trim();
  if (!r) return false;
  if (r.startsWith("refs/")) return false;
  if (/^[0-9a-f]{40}$/i.test(r)) return false;

  const regexStr = (getRuntimeEnv("K1W1_ALLOWED_REF_REGEX") ?? "").trim();
  if (!regexStr) return true; // rollout mode
  try {
    const re = new RegExp(regexStr);
    return re.test(r);
  } catch {
    return false;
  }
}

function isTriggerValidationError(
  result: ReturnType<typeof validateTriggerBuildRequest>,
): result is Extract<ReturnType<typeof validateTriggerBuildRequest>, { ok: false }> {
  return !result.ok;
}

/**
 * Creates a build_jobs row and triggers the GitHub repository_dispatch event (trigger-eas-build).
 *
 * Contract:
 * - Input: { githubRepo, buildProfile, branch }
 * - Output: { ok: true, jobId, githubRepo, branch, buildProfile }
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // Legacy guard lineage: generic admin-or-CI bearer guard (removed).
    const auth = requireScopedEdgeAuth(req, {
      scope: "trigger-eas-build",
      allowAdmin: true,
      allowJwtAuthHeaderWithAdmin: true,
      adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY",
    });
    if (auth) return auth;
    const jwtRoleGuard = await requireWorkflowOperatorJwtRole(req, "trigger-eas-build");
    if (jwtRoleGuard) return jwtRoleGuard;

    const durableRl = await requireDurableRateLimit(req, {
      scope: "trigger-eas-build",
      subject: getRequestRateLimitSubject(req),
      max: 10,
      windowMs: 60_000,
    });
    if (durableRl) return durableRl;

    const rl = rateLimit(req, "trigger-eas-build");
    if (rl) return rl;

    const parsed = await parseJsonBody(req, 200_000);
    if (isParsedJsonBodyError(parsed)) {
      return errorResponse(parsed.error, req, 400);
    }

    const validation = validateTriggerBuildRequest(parsed.body);
    if (isTriggerValidationError(validation)) {
      return errorResponse("Invalid request", req, 400, validation.errors);
    }

    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getServiceRoleKey(req);
    const GITHUB_TOKEN = getGithubToken();

    if (!supabaseUrl || !serviceRoleKey || !GITHUB_TOKEN) {
      return errorResponse("Missing required server env", req, 500, {
        SUPABASE_URL: !!supabaseUrl,
        SERVICE_ROLE: !!serviceRoleKey,
        GITHUB_TOKEN: !!GITHUB_TOKEN,
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { githubRepo, buildProfile, branch } = validation.data!;

    if (!isAllowedGithubRepo(githubRepo)) {
      return errorResponse("githubRepo not allowed", req, 403, { githubRepo });
    }

    if (!isAllowedRef(branch)) {
      return errorResponse("branch/ref not allowed", req, 403, { branch });
    }

    // Create job row
    const insertRes = await supabase
      .from("build_jobs")
      .insert({
        status: "queued",
        github_repo: githubRepo,
        build_profile: buildProfile,
        branch,
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
        branch,
        ref: branch,
        build_profile: buildProfile,
        buildProfile: buildProfile,
        job_id: jobId,
      },
    };

    const r = await githubFetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/dispatches`, {
      method: "POST",
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
        branch,
        buildProfile,
      },
      req,
      200,
    );
  } catch (e: unknown) {
    return errorResponse("Unexpected error", req, 500, {
      message: sanitizeErrorText(e instanceof Error ? e.message : String(e)),
    });
  }
});
