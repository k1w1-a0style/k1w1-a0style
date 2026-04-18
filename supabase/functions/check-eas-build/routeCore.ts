import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { validateCheckBuildRequest, parseJsonBody, isParsedJsonBodyError } from "../_shared/validation.ts";
import {
  getRequestRateLimitSubject,
  getServiceRoleKey,
  getSupabaseUrl,
  requireWorkflowOperatorJwtRole,
  requireScopedEdgeAuth,
  rateLimit,
  requireDurableRateLimit,
} from "../_shared/auth.ts";
import { sanitizeErrorText } from "../_shared/errorSanitization.ts";
import { buildReconciliationPatch } from "../_shared/buildJobConsistency.ts";

type SupabaseClientContract = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (field: string, value: number) => { maybeSingle: () => Promise<{ data: unknown; error: unknown }> };
    };
    update: (patch: Record<string, unknown>) => { eq: (field: string, value: number) => PromiseLike<unknown> };
  };
};

type BuildJobRow = {
  id: number;
  status?: string | null;
  github_repo?: string | null;
  github_run_id?: number | null;
  build_profile?: string | null;
  branch?: string | null;
  build_url?: string | null;
  download_url?: string | null;
  source_commit_sha?: string | null;
  artifact_name?: string | null;
  artifact_sha256?: string | null;
  artifact_size?: number | null;
  error_message?: string | null;
  error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ReconciliationInfo = {
  attempted: boolean;
  reconciled: boolean;
  upstream_status: number | null;
  upstream_error: string | null;
};

type CheckBuildRouteDeps = {
  createSupabaseClient: (url: string, key: string) => SupabaseClientContract;
  fetchRunState: (params: { githubRepo: string; runId: number }) => Promise<{
    attempted: boolean;
    upstream_status: number | null;
    runStatus: string | null;
    runConclusion: string | null;
    upstream_error: string | null;
  }>;
};

function isValidationError(
  result: ReturnType<typeof validateCheckBuildRequest>,
): result is Extract<ReturnType<typeof validateCheckBuildRequest>, { ok: false }> {
  return !result.ok;
}

export async function handleCheckEasBuildRequest(req: Request, deps: CheckBuildRouteDeps): Promise<Response> {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = requireScopedEdgeAuth(req, {
      scope: "check-eas-build",
      allowAdmin: true,
      adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY",
    });
    if (auth) return auth;
    const jwtRoleGuard = await requireWorkflowOperatorJwtRole(req, "check-eas-build");
    if (jwtRoleGuard) return jwtRoleGuard;

    const durableRl = await requireDurableRateLimit(req, {
      scope: "check-eas-build",
      subject: getRequestRateLimitSubject(req),
      max: 30,
      windowMs: 60_000,
    });
    if (durableRl) return durableRl;

    const rl = rateLimit(req, "check-eas-build");
    if (rl) return rl;

    const parsed = await parseJsonBody(req, 200_000);
    if (isParsedJsonBodyError(parsed)) return errorResponse(parsed.error, req, 400);

    const validation = validateCheckBuildRequest(parsed.body);
    if (isValidationError(validation)) {
      return errorResponse("Invalid request", req, 400, validation.errors);
    }

    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getServiceRoleKey(req);
    if (!supabaseUrl || !serviceRoleKey) {
      return errorResponse("Missing Supabase env", req, 500, {
        SUPABASE_URL: !!supabaseUrl,
        SERVICE_ROLE: !!serviceRoleKey,
      });
    }

    const supabase = deps.createSupabaseClient(supabaseUrl, serviceRoleKey);
    const { jobId } = validation.data!;
    const jobIdNumber = Number(jobId);
    const res = await supabase.from("build_jobs").select("*").eq("id", jobIdNumber).maybeSingle();

    if (res.error) return errorResponse("DB error", req, 500, res.error);
    if (!res.data) return errorResponse("Not found", req, 404, { jobId });

    const job = res.data as BuildJobRow;
    let reconciledStatus: "completed" | "error" | null = null;
    let reconciledFromGitHub = false;
    let reconciledPatch: Record<string, unknown> | null = null;
    const reconciliationInfo: ReconciliationInfo = { attempted: false, reconciled: false, upstream_status: null, upstream_error: null };

    if (job.github_repo && job.github_run_id) {
      const runState = await deps.fetchRunState({ githubRepo: job.github_repo, runId: job.github_run_id });
      reconciliationInfo.attempted = runState.attempted;
      reconciliationInfo.upstream_status = runState.upstream_status;
      reconciliationInfo.upstream_error = runState.upstream_error;
      if (!runState.upstream_error && runState.runStatus) {
        const reconciliation = buildReconciliationPatch({
          currentStatus: job.status,
          runStatus: runState.runStatus,
          runConclusion: runState.runConclusion,
          existingErrorMessage: job.error_message,
        });
        if (reconciliation) {
          reconciledStatus = reconciliation.nextStatus;
          reconciledFromGitHub = true;
          reconciliationInfo.reconciled = true;
          reconciledPatch = reconciliation.patch;
          await supabase.from("build_jobs").update(reconciliation.patch).eq("id", job.id);
        }
      }
    }

    const effectiveJob = reconciledPatch
      ? ({ ...job, ...reconciledPatch } as BuildJobRow)
      : job;

    const githubRunUrl = effectiveJob.github_run_id && effectiveJob.github_repo
      ? `https://github.com/${effectiveJob.github_repo}/actions/runs/${effectiveJob.github_run_id}`
      : null;
    const artifactsUrl = githubRunUrl ? `${githubRunUrl}#artifacts` : null;
    const downloadUrl = typeof effectiveJob.download_url === "string" && effectiveJob.download_url.trim() ? effectiveJob.download_url.trim() : null;
    const buildUrl = typeof effectiveJob.build_url === "string" && effectiveJob.build_url.trim() ? effectiveJob.build_url.trim() : null;
    const errorMessageRaw = typeof effectiveJob.error_message === "string" && effectiveJob.error_message.trim()
      ? effectiveJob.error_message.trim()
      : typeof effectiveJob.error === "string" && effectiveJob.error.trim() ? effectiveJob.error.trim() : null;
    const errorMessage = errorMessageRaw ? sanitizeErrorText(errorMessageRaw) : null;
    const sourceCommitSha = typeof effectiveJob.source_commit_sha === "string" && effectiveJob.source_commit_sha.trim()
      ? effectiveJob.source_commit_sha.trim()
      : null;
    const artifact = typeof effectiveJob.artifact_name === "string" && effectiveJob.artifact_name.trim()
      ? {
        name: effectiveJob.artifact_name,
        sha256: typeof effectiveJob.artifact_sha256 === "string" ? effectiveJob.artifact_sha256 : null,
        size: typeof effectiveJob.artifact_size === "number" ? effectiveJob.artifact_size : null,
      }
      : null;
    const urls = {
      html: githubRunUrl,
      githubRun: githubRunUrl,
      artifacts: artifactsUrl,
      buildUrl: downloadUrl ?? artifactsUrl ?? buildUrl,
    };

    return jsonResponse({
      ok: true,
      status: reconciledStatus ?? effectiveJob.status ?? null,
      reconciled_from_github: reconciledFromGitHub,
      reconciliation: reconciliationInfo,
      runId: effectiveJob.github_run_id ?? null,
      build_url: buildUrl,
      download_url: downloadUrl,
      source_commit_sha: sourceCommitSha,
      urls,
      job: {
        id: effectiveJob.id,
        status: reconciledStatus ?? effectiveJob.status,
        github_repo: effectiveJob.github_repo ?? null,
        github_run_id: effectiveJob.github_run_id ?? null,
        build_profile: effectiveJob.build_profile ?? null,
        branch: effectiveJob.branch ?? null,
        build_url: buildUrl,
        download_url: downloadUrl,
        source_commit_sha: sourceCommitSha,
        urls,
        artifact,
        error_message: errorMessage,
        created_at: effectiveJob.created_at ?? null,
        updated_at: effectiveJob.updated_at ?? null,
      },
    }, req, 200);
  } catch (e: unknown) {
    return errorResponse("Unexpected error", req, 500, {
      message: sanitizeErrorText(e instanceof Error ? e.message : String(e)),
    });
  }
}
