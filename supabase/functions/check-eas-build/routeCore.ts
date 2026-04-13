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
          await supabase.from("build_jobs").update(reconciliation.patch).eq("id", job.id);
        }
      }
    }

    const githubRunUrl = job.github_run_id && job.github_repo
      ? `https://github.com/${job.github_repo}/actions/runs/${job.github_run_id}`
      : null;
    const artifactsUrl = githubRunUrl ? `${githubRunUrl}#artifacts` : null;
    const downloadUrl = typeof job.download_url === "string" && job.download_url.trim() ? job.download_url.trim() : null;
    const buildUrl = typeof job.build_url === "string" && job.build_url.trim() ? job.build_url.trim() : null;
    const errorMessageRaw = typeof job.error_message === "string" && job.error_message.trim()
      ? job.error_message.trim()
      : typeof job.error === "string" && job.error.trim() ? job.error.trim() : null;
    const errorMessage = errorMessageRaw ? sanitizeErrorText(errorMessageRaw) : null;
    const sourceCommitSha = typeof job.source_commit_sha === "string" && job.source_commit_sha.trim()
      ? job.source_commit_sha.trim()
      : null;
    const artifact = typeof job.artifact_name === "string" && job.artifact_name.trim()
      ? {
        name: job.artifact_name,
        sha256: typeof job.artifact_sha256 === "string" ? job.artifact_sha256 : null,
        size: typeof job.artifact_size === "number" ? job.artifact_size : null,
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
      status: reconciledStatus ?? job.status ?? null,
      reconciled_from_github: reconciledFromGitHub,
      reconciliation: reconciliationInfo,
      runId: job.github_run_id ?? null,
      build_url: buildUrl,
      download_url: downloadUrl,
      source_commit_sha: sourceCommitSha,
      urls,
      job: {
        id: job.id,
        status: reconciledStatus ?? job.status,
        github_repo: job.github_repo ?? null,
        github_run_id: job.github_run_id ?? null,
        build_profile: job.build_profile ?? null,
        branch: job.branch ?? null,
        build_url: buildUrl,
        download_url: downloadUrl,
        source_commit_sha: sourceCommitSha,
        urls,
        artifact,
        error_message: errorMessage,
        created_at: job.created_at ?? null,
        updated_at: job.updated_at ?? null,
      },
    }, req, 200);
  } catch (e: unknown) {
    return errorResponse("Unexpected error", req, 500, {
      message: sanitizeErrorText(e instanceof Error ? e.message : String(e)),
    });
  }
}
