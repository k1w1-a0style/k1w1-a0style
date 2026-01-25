import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import {
  validateCheckBuildRequest,
  parseJsonBody,
} from "../_shared/validation.ts";
import { requireAdminKey, rateLimit } from "../_shared/auth.ts";
import { githubHeaders } from "../_shared/github.ts";

serve(async (req) => {
  if (handleCors(req)) return handleCors(req);

  try {
    const auth = requireAdminKey(req);
    if (auth) return auth;

    const rl = rateLimit(req, "check-eas-build");
    if (rl) return rl;

    const parsed = await parseJsonBody(req, 200_000);
    if (!parsed.ok) return errorResponse(parsed.error, req, 400);

    const validation = validateCheckBuildRequest(parsed.body);
    if (!validation.ok) return errorResponse("Invalid request", req, 400, validation.errors);

    const SUPABASE_URL = Deno.env.get("K1W1_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
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

    const job = res.data as any;

    const githubRunUrl =
      job.github_run_id && job.github_repo
        ? `https://github.com/${job.github_repo}/actions/runs/${job.github_run_id}`
        : null;
    const artifactsUrl = githubRunUrl ? `${githubRunUrl}#artifacts` : null;

    // Optional fields (added by newer workflows/migrations)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyJob = job as any;
    const downloadUrl =
      typeof anyJob.download_url === "string" && anyJob.download_url.trim()
        ? anyJob.download_url.trim()
        : null;

    const artifact =
      typeof anyJob.artifact_name === "string" && anyJob.artifact_name.trim()
        ? {
            name: anyJob.artifact_name,
            sha256:
              typeof anyJob.artifact_sha256 === "string" ? anyJob.artifact_sha256 : null,
            size: typeof anyJob.artifact_size === "number" ? anyJob.artifact_size : null,
          }
        : null;

    return jsonResponse(
      {
        ok: true,
        job: {
          id: job.id,
          status: job.status,
          github_repo: job.github_repo ?? null,
          github_run_id: job.github_run_id ?? null,
          build_profile: job.build_profile ?? null,
          branch: job.branch ?? null,
          build_url: job.build_url ?? null,
          download_url: downloadUrl,
          urls: {
            html: githubRunUrl,
            githubRun: githubRunUrl,
            buildUrl: job.build_url ?? null,
            artifacts: artifactsUrl,
          },
          artifact,
          error: job.error ?? null,
          created_at: job.created_at ?? null,
          updated_at: job.updated_at ?? null,
        },
      },
      req,
      200,
    );
  } catch (e) {
    return errorResponse("Unexpected error", req, 500, {
      message: e?.message ?? String(e),
    });
  }
});
