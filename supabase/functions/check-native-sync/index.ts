import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

type ReqBody = { jobId?: string | number };

function safeStr(v: any) {
  return v == null ? "" : String(v);
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = (await req.json().catch(() => ({}))) as ReqBody;
    const jobIdRaw = body.jobId;

    const jobId = Number(jobIdRaw);
    if (!Number.isFinite(jobId) || jobId <= 0) {
      return errorResponse(
        "Validation failed: jobId missing/invalid",
        req,
        400,
      );
    }

    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
    const SUPABASE_URL = Deno.env.get("K1W1_SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("K1W1_SUPABASE_SERVICE_ROLE_KEY");

    if (!GITHUB_TOKEN || !SUPABASE_URL || !SERVICE_ROLE) {
      return errorResponse("Missing required environment variables", req, 500);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const jobRes = await supabase
      .from("native_sync_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobRes.error || !jobRes.data) {
      return errorResponse(
        "native_sync_jobs lookup failed",
        req,
        404,
        jobRes.error,
      );
    }

    const job = jobRes.data;
    const repo = safeStr(job.github_repo);
    if (!repo)
      return errorResponse(
        "native_sync_jobs row missing github_repo",
        req,
        500,
      );

    // Find matching workflow run by run-name "Sync Native Deps (job <id>)"
    const runsUrl = `https://api.github.com/repos/${repo}/actions/workflows/k1w1-sync-native.yml/runs?per_page=30`;
    const ghRes = await fetch(runsUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
      },
    });

    const ghJson = await ghRes.json().catch(() => null);
    const runs = ghJson?.workflow_runs ?? [];

    const wanted = `job ${jobId}`;
    const run =
      runs.find((r: any) => safeStr(r?.name).includes(wanted)) ||
      runs[0] ||
      null;

    // Map status
    let status = safeStr(job.status || "waiting").toLowerCase();
    let runStatus = run ? safeStr(run.status).toLowerCase() : "";
    let runConclusion = run ? safeStr(run.conclusion).toLowerCase() : "";

    if (run) {
      if (runStatus === "queued") status = "queued";
      else if (runStatus === "in_progress") status = "running";
      else if (runStatus === "completed")
        status = runConclusion === "success" ? "success" : "failed";
    }

    // Keep helpful URLs
    const htmlUrl = run?.html_url ?? job.run_html_url ?? null;
    const runId = run?.id ?? job.github_run_id ?? null;

    return jsonResponse(
      {
        ok: true,
        status,
        run: run
          ? {
              id: runId,
              status: runStatus,
              conclusion: runConclusion,
              html_url: htmlUrl,
              created_at: run?.created_at ?? null,
              updated_at: run?.updated_at ?? null,
            }
          : null,
        job,
      },
      req,
    );
  } catch (err: any) {
    console.error(
      "❌ check-native-sync error",
      err?.message ?? err,
      err?.stack,
    );
    return errorResponse(err?.message || "Unknown error", req, 500);
  }
});
