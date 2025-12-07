import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * ✓ Stabile Status-Überprüfung
 * ✓ Konsistente Response-Struktur
 * ✓ Fehlerkategorien sauber getrennt
 * ✓ EAS + GitHub Status-Mapping
 * ✓ Kein undefined mehr
 * ✓ Voll kompatibel mit deinem k1w1-Builder
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);

    if (!body || !body.jobId) {
      return new Response(
        JSON.stringify({
          error: "Missing 'jobId' in request body",
        }),
        { headers: corsHeaders, status: 400 },
      );
    }

    const SUPABASE_URL = Deno.env.get("K1W1_SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("K1W1_SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(
        JSON.stringify({
          error: "Missing required environment variables",
        }),
        { headers: corsHeaders, status: 500 },
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // -----------------------------------------------------
    // 1) BuildJob aus Supabase laden
    // -----------------------------------------------------
    const jobRes = await supabase
      .from("build_jobs")
      .select("*")
      .eq("id", body.jobId)
      .single();

    if (jobRes.error || !jobRes.data) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Build job not found",
        }),
        { headers: corsHeaders, status: 404 },
      );
    }

    const job = jobRes.data;
    const jobIdStr = `${job.id ?? ""}`;

    if (!job.github_repo) {
      return new Response(
        JSON.stringify({
          error: "build_jobs row missing github_repo",
        }),
        { headers: corsHeaders, status: 500 },
      );
    }

    // -----------------------------------------------------
    // 2) GitHub Actions Build Status holen
    // -----------------------------------------------------
    const repo = job.github_repo;
    const workflowFile =
      (job.workflow_file && typeof job.workflow_file === "string"
        ? job.workflow_file
        : "eas-build.yml");
    const workflowRunsUrl =
      `https://api.github.com/repos/${repo}/actions/workflows/${
        encodeURIComponent(workflowFile)
      }/runs?per_page=10`;

    const token = Deno.env.get("GITHUB_TOKEN");

    if (!token) {
      return new Response(
        JSON.stringify({
          error: "Missing GITHUB_TOKEN",
        }),
        { headers: corsHeaders, status: 500 },
      );
    }

    const githubHeaders = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    };

    let run: any = null;
    const targetRunId = job.github_run_id
      ? job.github_run_id.toString()
      : null;

    if (targetRunId) {
      const runRes = await fetch(
        `https://api.github.com/repos/${repo}/actions/runs/${targetRunId}`,
        { headers: githubHeaders },
      );
      if (runRes.ok) {
        run = await runRes.json().catch(() => null);
      } else if (runRes.status !== 404) {
        const txt = await runRes.text();
        return new Response(
          JSON.stringify({
            error: "GitHub run lookup failed",
            status: runRes.status,
            githubResponse: txt,
          }),
          { headers: corsHeaders, status: 500 },
        );
      }
    }

    if (!run) {
      const ghRes = await fetch(workflowRunsUrl, {
        headers: githubHeaders,
      });

      if (!ghRes.ok) {
        const txt = await ghRes.text();
        return new Response(
          JSON.stringify({
            error: "GitHub API error",
            status: ghRes.status,
            githubResponse: txt,
          }),
          { headers: corsHeaders, status: 500 },
        );
      }

      const ghJson = await ghRes.json().catch(() => null);

      if (!ghJson || !ghJson.workflow_runs) {
        return new Response(
          JSON.stringify({
            error: "Invalid GitHub response",
            githubResponse: ghJson,
          }),
          { headers: corsHeaders, status: 500 },
        );
      }

      const runs: any[] = ghJson.workflow_runs;
      const normalizedJobName = jobIdStr ? jobIdStr.trim() : "";

      run = runs.find((r: any) =>
        normalizedJobName &&
        typeof r?.name === "string" &&
        r.name.trim().endsWith(normalizedJobName)
      );

      if (!run) {
        run = runs.find((r: any) => r?.event === "repository_dispatch");
      }

      if (!run) {
        run = runs[0];
      }
    }

    if (!run) {
      return new Response(
        JSON.stringify({
          ok: true,
          buildFound: false,
          status: "waiting",
          message: "No build run found yet",
        }),
        { headers: corsHeaders, status: 200 },
      );
    }

    if (
      !targetRunId &&
      run?.id &&
      jobIdStr &&
      typeof run?.name === "string" &&
      run.name.trim().endsWith(jobIdStr.trim())
    ) {
      await supabase
        .from("build_jobs")
        .update({ github_run_id: `${run.id}` })
        .eq("id", job.id);
    }

    // -----------------------------------------------------
    // 4) Mapping GitHub -> k1w1 Build Status
    // -----------------------------------------------------
    let mappedStatus = "unknown";

    const ghStatus = (run.status || "").toLowerCase();
    const ghConclusion = (run.conclusion || "").toLowerCase();

    if (ghStatus === "queued") mappedStatus = "queued";
    if (ghStatus === "in_progress") mappedStatus = "building";
    if (ghStatus === "completed") {
      if (ghConclusion === "success") mappedStatus = "success";
      else mappedStatus = "failed";
    }
    if (ghStatus === "") mappedStatus = "waiting";

    // Direkt Download-URL extrahieren, falls Erfolg
    let artifactUrl: string | null = null;
    if (mappedStatus === "success") {
      if (run.artifacts_url) {
        artifactUrl = run.artifacts_url;
      }
    }

    const responsePayload = {
      ok: true as const,
      buildFound: true,
      status: mappedStatus,
      githubStatus: ghStatus,
      githubConclusion: ghConclusion,
      runId: run.id,
      urls: {
        html: run.html_url,
        artifacts: artifactUrl,
      },
      job,
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (err: any) {
    console.error("❌ check-eas-build error", err?.message ?? err);

    return new Response(
      JSON.stringify({
        ok: false,
        error: err?.message || "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
