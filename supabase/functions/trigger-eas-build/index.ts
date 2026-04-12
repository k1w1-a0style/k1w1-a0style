import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import {
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
import {
  githubFetch,
  getGithubToken,
  GITHUB_API_BASE,
  isAllowedGitRef,
  isAllowedGithubRepo,
} from "../_shared/github.ts";
import { sanitizeErrorText, sanitizeGitHubFailure } from "../_shared/errorSanitization.ts";
import { resolveCommitShaBestEffort } from "./helpers.ts";
import { runTriggerBuildFlow } from "./flow.ts";

function isTriggerValidationError(
  result: ReturnType<typeof validateTriggerBuildRequest>,
): result is Extract<ReturnType<typeof validateTriggerBuildRequest>, { ok: false }> {
  return !result.ok;
}

async function resolveCommitSha(githubRepo: string, branch: string): Promise<string | null> {
  const [owner, repo] = githubRepo.split("/");
  const commitResp = await githubFetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${encodeURIComponent(branch)}`,
    { method: "GET" },
  );
  if (!commitResp.ok) return null;
  const json = await commitResp.json().catch(() => null) as { sha?: unknown } | null;
  return typeof json?.sha === "string" && json.sha.trim() ? json.sha.trim() : null;
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

    if (!isAllowedGitRef(branch)) {
      return errorResponse("branch/ref not allowed", req, 403, { branch });
    }

    const flow = await runTriggerBuildFlow(
      { githubRepo, buildProfile, branch },
      {
        resolveCommitSha: async (repoName, branchName) =>
          await resolveCommitShaBestEffort({
            githubRepo: repoName,
            branch: branchName,
            fetchCommitSha: ({ githubRepo: r, branch: b }) => resolveCommitSha(r, b),
          }),
        insertBuildJob: async (row) => {
          const insertRes = await supabase
            .from("build_jobs")
            .insert({
              status: "queued",
              ...row,
            })
            .select("id")
            .single();
          if (insertRes.error) {
            throw new Error(`insert_failed:${sanitizeErrorText(insertRes.error.message)}`);
          }
          return { id: insertRes.data.id };
        },
        dispatchBuild: async ({ githubRepo: repoName, payload }) => {
          const [owner, repo] = repoName.split("/");
          const r = await githubFetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/dispatches`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          return {
            ok: r.ok,
            status: r.status,
            bodyText: await r.text().catch(() => ""),
          };
        },
        patchBuildJobOnDispatchFailure: async (id, patch) => {
          await supabase.from("build_jobs").update(patch).eq("id", id);
        },
      },
    );

    if (!flow.ok) {
      const failedResponse = new Response(flow.bodyText, { status: flow.status });
      return errorResponse("GitHub dispatch failed", req, 502, sanitizeGitHubFailure(failedResponse, flow.bodyText));
    }

    return jsonResponse(
      {
        ok: true,
        jobId: flow.jobId,
        githubRepo,
        branch,
        buildProfile,
        source_commit_sha: flow.sourceCommitSha,
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
