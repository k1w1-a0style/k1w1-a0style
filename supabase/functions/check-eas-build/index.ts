import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { validateCheckBuildRequest } from "../_shared/validation.ts";

/**
 * check-eas-build (robust)
 * - bevorzugt build_jobs.status + urls (weil Workflow diese schreibt)
 * - wenn github_run_id vorhanden: holt Run-Details direkt /actions/runs/:id
 * - fallback: holt runs von eas-build.yml
 */
function pick(job: any, keys: string[]) {
  for (const k of keys) {
    const v = job?.[k];
    if (v != null && String(v).trim() !== "") return v;
  }
  return null;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json().catch(() => null);
    const validation = validateCheckBuildRequest(body);

    if (!validation.valid) {
      return errorResponse("Validation failed", req, 400, {
        errors: validation.errors,
      });
    }

    const { jobId } = validation.data!;

    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
    const SUPABASE_URL = Deno.env.get("K1W1_SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("K1W1_SUPABASE_SERVICE_ROLE_KEY");

    if (!GITHUB_TOKEN || !SUPABASE_URL || !SERVICE_ROLE) {
      return errorResponse("Missing required environment variables", req, 500);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const jobRes = await supabase
      .from("build_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobRes.error || !jobRes.data) {
      return errorResponse("build_jobs lookup failed", req, 404, jobRes.error);
    }

    const job = jobRes.data;
    const repo = String(job.github_repo || "");
    if (!repo) {
      return errorResponse("build_jobs row missing github_repo", req, 500);
    }

    const jobStatus = String(job.status || "").toLowerCase();
    const buildUrl = pick(job, ["build_url", "buildUrl", "url"]);
    const artifactUrl = pick(job, [
      "artifact_url",
      "artifactUrl",
      "apk_url",
      "apkUrl",
    ]);
    const ghRunId = pick(job, [
      "github_run_id",
      "githubRunId",
      "run_id",
      "runId",
    ]);

    let run: any = null;

    // Best: run_id direkt
    if (ghRunId) {
      const ghRunUrl = `https://api.github.com/repos/${repo}/actions/runs/${ghRunId}`;
      const ghRunRes = await fetch(ghRunUrl, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${GITHUB_TOKEN}`,
        },
      });
      if (ghRunRes.ok) run = await ghRunRes.json().catch(() => null);
    }

    // Fallback: eas-build.yml runs
    if (!run) {
      const ghUrl = `https://api.github.com/repos/${repo}/actions/workflows/eas-build.yml/runs?per_page=15`;
      const ghRes = await fetch(ghUrl, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${GITHUB_TOKEN}`,
        },
      });
      const ghJson = await ghRes.json().catch(() => null);
      run = ghJson?.workflow_runs?.[0] || null;
    }

    // Map status: prefer job.status
    let status = "waiting";
    if (jobStatus) {
      if (["queued", "dispatched", "waiting"].includes(jobStatus))
        status = "queued";
      else if (["building", "in_progress", "running"].includes(jobStatus))
        status = "building";
      else if (["success", "succeeded"].includes(jobStatus)) status = "success";
      else if (["failed", "error"].includes(jobStatus)) status = "failed";
      else status = jobStatus;
    } else if (run) {
      const ghStatus = String(run.status || "").toLowerCase();
      const ghConclusion = String(run.conclusion || "").toLowerCase();
      if (ghStatus === "queued") status = "queued";
      if (ghStatus === "in_progress") status = "building";
      if (ghStatus === "completed")
        status = ghConclusion === "success" ? "success" : "failed";
    }

    return jsonResponse(
      {
        ok: true,
        buildFound: !!run || status !== "waiting",
        status,
        runId: run?.id ?? null,
        urls: {
          html: run?.html_url ?? null,
          build: buildUrl ?? null,
          artifacts: artifactUrl ?? null,
        },
        job,
      },
      req,
    );
  } catch (err: any) {
    console.error("❌ check-eas-build error", err?.message ?? err, err?.stack);
    return errorResponse(err?.message || "Unknown error", req, 500);
  }
});
