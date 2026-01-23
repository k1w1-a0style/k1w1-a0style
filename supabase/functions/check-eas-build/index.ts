import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import {
  validateCheckBuildRequest,
  parseJsonBody,
} from "../_shared/validation.ts";
import { requireAdminKey, rateLimit } from "../_shared/auth.ts";
import { githubHeaders } from "../_shared/github.ts";

/**
 * ✓ Stabile Status-Überprüfung (Source of Truth: build_jobs Row)
 * ✓ Keine flakey GitHub-API Suche nach "irgendeinem" Run
 * ✓ Response bleibt kompatibel (status, urls, runId)
 * ✓ SEC-011: Input Validation
 */

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const auth = requireAdminKey(req);
  if (auth) return auth;

  const rl = rateLimit(req, "check-eas-build");
  if (rl) return rl;

  try {
    const body = await parseJsonBody(req, 20 * 1024);

    // ✅ SEC-011: Strikte Input-Validierung
    const validation = validateCheckBuildRequest(body);
    if (!validation.valid) {
      return errorResponse("Validation failed", req, 400, {
        errors: validation.errors,
      });
    }

    const { jobId } = validation.data!;

    const SUPABASE_URL = Deno.env.get("K1W1_SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("K1W1_SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return errorResponse("Missing required environment variables", req, 500, {
        missing: {
          SUPABASE_URL: !!SUPABASE_URL,
          SERVICE_ROLE: !!SERVICE_ROLE,
        },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // -----------------------------------------------------
    // 1) BuildJob aus Supabase laden
    // -----------------------------------------------------
    const jobRes = await supabase
      .from("build_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobRes.error || !jobRes.data) {
      return errorResponse("Build job not found", req, 404, {
        jobId,
      });
    }

    const job = jobRes.data;

    // -----------------------------------------------------
    // 2) Response ableiten (DB = Source of Truth)
    // -----------------------------------------------------
    const status = (job.status || "queued").toString();

    const repo = typeof job.github_repo === "string" ? job.github_repo : null;
    const runId = job.github_run_id
      ? Number.parseInt(String(job.github_run_id), 10)
      : null;

    const buildUrl = job.build_url ? String(job.build_url) : null;
    const githubRunUrl =
      repo && runId && Number.isFinite(runId)
        ? `https://github.com/${repo}/actions/runs/${runId}`
        : null;

    return jsonResponse(
      {
        ok: true,
        status,
        runId: runId && Number.isFinite(runId) ? runId : null,

        // Backwards compatible fields used in RN code
        build_url: buildUrl,
        download_url: null,

        urls: {
          // Für UI: zuerst EAS Build URL (wenn vorhanden), sonst GitHub Run
          html: buildUrl ?? githubRunUrl,
          artifacts: null,
          githubRun: githubRunUrl,
        },

        errorMessage: job.error_message ?? null,
        job,
      },
      req,
    );
  } catch (err: any) {
    console.error("❌ check-eas-build error", err?.message ?? err, err?.stack);

    return errorResponse("Unhandled exception in check-eas-build", req, 500, {
      message: err?.message || "Unknown error",
    });
  }
});
