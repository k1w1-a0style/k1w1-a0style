import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { validateCheckBuildRequest } from "../_shared/validation.ts";

/**
 * ✅ check-eas-build (kritisch stabilisiert)
 * - bevorzugt build_jobs.status + build_url/artifact_url (weil Workflow diese setzt)
 * - wenn github_run_id vorhanden: holt Run-Details direkt über /actions/runs/:id
 * - fallback: schaut workflow runs von eas-build.yml
 */

function pickJobField(job: any, keys: string[]) {
  for (const k of keys) {
    if (job && job[k] != null && String(job[k]).trim() !== "") return job[k];
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

    // 1) build_jobs row holen
    const jobRes = await supabase
      .from("build_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobRes.error || !jobRes.data) {
      return errorResponse("build_jobs lookup failed", req, 404, jobRes.error);
    }

    const job = jobRes.data;

    if (!job.github_repo) {
      return errorResponse("build_jobs row missing github_repo", req, 500);
    }

    const repo = String(job.github_repo);
    const jobStatus = String(job.status || "").toLowerCase();

    const buildUrl = pickJobField(job, ["build_url", "buildUrl", "url"]) as
      | string
      | null;
    const artifactUrl = pickJobField(job, [
      "artifact_url",
      "artifactUrl",
      "apk_url",
      "apkUrl",
    ]) as string | null;

    const ghRunId = pickJobField(job, [
      "github_run_id",
      "githubRunId",
      "run_id",
      "runId",
    ]);

    let run: any = null;

    // 2) wenn wir run_id haben: direkt fetchen (beste Variante)
    if (ghRunId) {
      const ghRunUrl = `https://api.github.com/repos/${repo}/actions/runs/${ghRunId}`;
      const ghRunRes = await fetch(ghRunUrl, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${GITHUB_TOKEN}`,
        },
      });

      if (ghRunRes.ok) {
        run = await ghRunRes.json().catch(() => null);
      }
    }

    // 3) fallback: nur runs von eas-build.yml (nicht "irgendein run")
    if (!run) {
      const ghUrl = `https://api.github.com/repos/${repo}/actions/workflows/eas-build.yml/runs?per_page=15`;
      const ghRes = await fetch(ghUrl, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${GITHUB_TOKEN}`,
        },
      });

      const ghJson = await ghRes.json().catch(() => null);
      if (
        ghJson &&
        ghJson.workflow_runs &&
        Array.isArray(ghJson.workflow_runs)
      ) {
        run = ghJson.workflow_runs[0] || null;
      }
    }

    // 4) Status mapping: bevorzugt job.status, sonst GitHub
    let mappedStatus = "waiting";

    if (jobStatus) {
      if (["queued", "dispatched", "waiting"].includes(jobStatus))
        mappedStatus = "queued";
      else if (["building", "in_progress", "running"].includes(jobStatus))
        mappedStatus = "building";
      else if (["success", "succeeded"].includes(jobStatus))
        mappedStatus = "success";
      else if (["failed", "error"].includes(jobStatus)) mappedStatus = "failed";
      else mappedStatus = jobStatus;
    } else if (run) {
      const ghStatus = String(run.status || "").toLowerCase();
      const ghConclusion = String(run.conclusion || "").toLowerCase();

      if (ghStatus === "queued") mappedStatus = "queued";
      if (ghStatus === "in_progress") mappedStatus = "building";
      if (ghStatus === "completed")
        mappedStatus = ghConclusion === "success" ? "success" : "failed";
      if (ghStatus === "") mappedStatus = "waiting";
    }

    const runHtml = run?.html_url ? String(run.html_url) : null;

    const buildFound = !!run || mappedStatus !== "waiting";

    return jsonResponse(
      {
        ok: true,
        buildFound,
        status: mappedStatus,
        runId: run?.id ?? null,
        urls: {
          html: runHtml,
          build: buildUrl,
          artifacts: artifactUrl,
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
