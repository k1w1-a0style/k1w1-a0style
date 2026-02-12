import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { validateCheckBuildRequest, parseJsonBody } from "../_shared/validation.ts";
import { requireAdminKey, rateLimit } from "../_shared/auth.ts";
import { sanitizeErrorText } from "../_shared/errorSanitization.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = requireAdminKey(req);
    if (auth) return auth;

    const rl = rateLimit(req, "check-eas-build");
    if (rl) return rl;

    const parsed = await parseJsonBody(req, 200_000);
    if (!parsed.ok) return errorResponse(parsed.error, req, 400);

    const validation = validateCheckBuildRequest(parsed.body);
    if (!validation.ok) {
      return errorResponse("Invalid request", req, 400, validation.errors);
    }

    const SUPABASE_URL =
      Deno.env.get("K1W1_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE =
      Deno.env.get("K1W1_SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return errorResponse("Missing Supabase env", req, 500, {
        SUPABASE_URL: !!SUPABASE_URL,
        SERVICE_ROLE: !!SERVICE_ROLE,
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { jobId } = validation.data!;
    const res = await supabase
      .from("build_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();

    if (res.error) return errorResponse("DB error", req, 500, res.error);
    if (!res.data) return errorResponse("Not found", req, 404, { jobId });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const job: any = res.data;

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
  } catch (e) {
    return errorResponse("Unexpected error", req, 500, {
      message: sanitizeErrorText(e?.message ?? String(e)),
    });
  }
});
