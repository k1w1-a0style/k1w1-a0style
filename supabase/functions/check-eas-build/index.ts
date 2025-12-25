import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Returns the build status for a given build job id.
// - Prefers the exact GitHub Actions run id stored on the job (github_run_id), to avoid reading the wrong run.
// - Also returns artifact_url / build_url if the workflow stored them.

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const buildId = url.searchParams.get("buildId");

    if (!buildId) {
      return new Response(
        JSON.stringify({ error: "Missing buildId parameter" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const githubToken = Deno.env.get("GITHUB_TOKEN");

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Supabase config missing" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (!githubToken) {
      return new Response(JSON.stringify({ error: "GitHub token missing" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch job row
    const { data: job, error: jobError } = await supabase
      .from("build_jobs")
      .select("*")
      .eq("id", buildId)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({
          error: "Build job not found",
          details: jobError?.message,
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const repo: string = job.github_repo;
    const runId: number | null = job.github_run_id
      ? Number(job.github_run_id)
      : null;

    const urls = {
      html: runId ? `https://github.com/${repo}/actions/runs/${runId}` : null,
      artifacts: job.artifact_url || null,
      build: job.build_url || null,
    };

    // If the job already has a final status from workflow, return it immediately.
    if (["success", "failed", "error"].includes(job.status)) {
      return new Response(
        JSON.stringify({
          status: job.status,
          runId,
          urls,
          job,
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // GitHub API helper
    const gh = async (endpoint: string) => {
      const res = await fetch(`https://api.github.com${endpoint}`, {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || `GitHub API error (${res.status})`);
      }
      return data;
    };

    // Fetch the exact run if we have runId, otherwise fall back to latest runs.
    let run: any = null;

    if (runId) {
      run = await gh(`/repos/${repo}/actions/runs/${runId}`);
    } else {
      const runs = await gh(`/repos/${repo}/actions/runs?per_page=10`);
      run = runs?.workflow_runs?.[0] || null;
    }

    if (!run) {
      return new Response(JSON.stringify({ error: "No workflow runs found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const mappedStatus =
      run.status === "queued"
        ? "queued"
        : run.status === "in_progress"
          ? "building"
          : run.status === "completed"
            ? run.conclusion === "success"
              ? "success"
              : run.conclusion === "cancelled"
                ? "cancelled"
                : "failed"
            : "unknown";

    // If workflow completed but did not update DB for some reason, we still return its status.
    const finalUrls = {
      html: run.html_url || urls.html,
      artifacts: urls.artifacts,
      build: urls.build,
    };

    return new Response(
      JSON.stringify({
        status: mappedStatus,
        runId: run.id,
        urls: finalUrls,
        job,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
