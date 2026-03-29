import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { validateCheckBuildRequest, parseJsonBody } from "../_shared/validation.ts";
import {
  getServiceRoleKey,
  getSupabaseUrl,
  requireWorkflowOperatorJwtRole,
  requireScopedEdgeAuth,
  rateLimit,
  requireDurableRateLimit,
} from "../_shared/auth.ts";
import { sanitizeErrorText } from "../_shared/errorSanitization.ts";

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

function isParsedBodyError(
  result: Awaited<ReturnType<typeof parseJsonBody>>,
): result is { ok: false; error: string } {
  return !result.ok;
}

function isValidationError(
  result: ReturnType<typeof validateCheckBuildRequest>,
): result is Extract<ReturnType<typeof validateCheckBuildRequest>, { ok: false }> {
  return !result.ok;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // Legacy guard lineage: generic admin-or-CI bearer guard (removed).
    const auth = requireScopedEdgeAuth(req, {
      scope: "check-eas-build",
      allowAdmin: true,
      allowJwtAuthHeaderWithAdmin: true,
      adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY",
    });
    if (auth) return auth;
    const jwtRoleGuard = await requireWorkflowOperatorJwtRole(req, "check-eas-build");
    if (jwtRoleGuard) return jwtRoleGuard;

    const durableRl = await requireDurableRateLimit(req, {
      scope: "check-eas-build",
      subject: req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown",
      max: 30,
      windowMs: 60_000,
    });
    if (durableRl) return durableRl;

    const rl = rateLimit(req, "check-eas-build");
    if (rl) return rl;

    const parsed = await parseJsonBody(req, 200_000);
    if (isParsedBodyError(parsed)) return errorResponse(parsed.error, req, 400);

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

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { jobId } = validation.data!;
    // build_jobs.id is currently bigint-backed in the database.
    // Keep the edge contract explicit here: callers pass a positive integer id,
    // but we still normalize to Number for the actual DB filter.
    const jobIdNumber = Number(jobId);
    const res = await supabase
      .from("build_jobs")
      .select("*")
      .eq("id", jobIdNumber)
      .maybeSingle();

    if (res.error) return errorResponse("DB error", req, 500, res.error);
    if (!res.data) return errorResponse("Not found", req, 404, { jobId });

    const job = res.data as BuildJobRow;

    const githubRunUrl =
      job.github_run_id && job.github_repo
        ? `https://github.com/${job.github_repo}/actions/runs/${job.github_run_id}`
        : null;
    const artifactsUrl = githubRunUrl ? `${githubRunUrl}#artifacts` : null;

    const downloadUrl =
      typeof job.download_url === "string" && job.download_url.trim()
        ? job.download_url.trim()
        : null;

    const buildUrl =
      typeof job.build_url === "string" && job.build_url.trim()
        ? job.build_url.trim()
        : null;

    const errorMessageRaw =
      typeof job.error_message === "string" && job.error_message.trim()
        ? job.error_message.trim()
        : typeof job.error === "string" && job.error.trim()
          ? job.error.trim()
          : null;

    // Never leak secrets via job error payloads.
    const errorMessage = errorMessageRaw ? sanitizeErrorText(errorMessageRaw) : null;

    const sourceCommitSha =
      typeof job.source_commit_sha === "string" && job.source_commit_sha.trim()
        ? job.source_commit_sha.trim()
        : null;

    const artifact =
      typeof job.artifact_name === "string" && job.artifact_name.trim()
        ? {
            name: job.artifact_name,
            sha256: typeof job.artifact_sha256 === "string" ? job.artifact_sha256 : null,
            size: typeof job.artifact_size === "number" ? job.artifact_size : null,
          }
        : null;

    // Compatibility: return both top-level and nested fields
    const urls = {
      html: githubRunUrl,
      githubRun: githubRunUrl,
      artifacts: artifactsUrl,
      buildUrl: downloadUrl ?? artifactsUrl ?? buildUrl,
    };

    return jsonResponse(
      {
        ok: true,
        status: job.status ?? null,
        runId: job.github_run_id ?? null,
        build_url: buildUrl,
        download_url: downloadUrl,
        source_commit_sha: sourceCommitSha,
        urls,
        job: {
          id: job.id,
          status: job.status,
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
