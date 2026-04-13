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
  getGithubToken,
  isAllowedGitRef,
  isAllowedGithubRepo,
} from "../_shared/github.ts";
import { sanitizeErrorText, sanitizeGitHubFailure } from "../_shared/errorSanitization.ts";
import { runTriggerBuildFlow } from "./flow.ts";

type SupabaseClientContract = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => {
      select: (columns: string) => {
        single: () => Promise<{ data: Record<string, unknown>; error: { message?: string } | null }>;
      };
    };
    update: (patch: Record<string, unknown>) => { eq: (field: string, id: number) => PromiseLike<unknown> };
  };
};

type TriggerBuildRouteDeps = {
  createSupabaseClient: (url: string, key: string) => SupabaseClientContract;
  githubDispatch: (params: { githubRepo: string; payload: Record<string, unknown> }) => Promise<{
    ok: boolean;
    status: number;
    bodyText: string;
  }>;
  resolveCommitShaBestEffort: (githubRepo: string, branch: string) => Promise<string | null>;
};

function isTriggerValidationError(
  result: ReturnType<typeof validateTriggerBuildRequest>,
): result is Extract<ReturnType<typeof validateTriggerBuildRequest>, { ok: false }> {
  return !result.ok;
}

export async function handleTriggerEasBuildRequest(
  req: Request,
  deps: TriggerBuildRouteDeps,
): Promise<Response> {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = requireScopedEdgeAuth(req, {
      scope: "trigger-eas-build",
      allowAdmin: true,
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
    if (isParsedJsonBodyError(parsed)) return errorResponse(parsed.error, req, 400);

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

    const supabase = deps.createSupabaseClient(supabaseUrl, serviceRoleKey);
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
        resolveCommitSha: async (repoName, branchName) => await deps.resolveCommitShaBestEffort(repoName, branchName),
        insertBuildJob: async (row) => {
          const insertRes = await supabase.from("build_jobs").insert({ status: "queued", ...row }).select("id").single();
          if (insertRes.error) throw new Error(`insert_failed:${sanitizeErrorText(insertRes.error.message)}`);
          const insertedId = Number(insertRes.data.id);
          if (!Number.isFinite(insertedId) || insertedId <= 0) {
            throw new Error("insert_failed:invalid_job_id");
          }
          return { id: insertedId };
        },
        dispatchBuild: async ({ githubRepo: repoName, payload }) => await deps.githubDispatch({ githubRepo: repoName, payload }),
        patchBuildJobOnDispatchFailure: async (id, patch) => {
          await supabase.from("build_jobs").update(patch).eq("id", id);
        },
      },
    );

    if (flow.ok === false) {
      const failedResponse = new Response(flow.bodyText, { status: flow.status });
      return errorResponse("GitHub dispatch failed", req, 502, sanitizeGitHubFailure(failedResponse, flow.bodyText));
    }

    return jsonResponse({
      ok: true,
      jobId: flow.jobId,
      githubRepo,
      branch,
      buildProfile,
      source_commit_sha: flow.sourceCommitSha,
    }, req, 200);
  } catch (e: unknown) {
    return errorResponse("Unexpected error", req, 500, {
      message: sanitizeErrorText(e instanceof Error ? e.message : String(e)),
    });
  }
}
