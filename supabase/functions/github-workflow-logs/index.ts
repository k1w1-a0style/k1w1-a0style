import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Fetches GitHub Actions workflow logs
 * Returns parsed logs with timestamps and levels
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);

    if (!body || !body.githubRepo || !body.runId) {
      return new Response(
        JSON.stringify({
          error: "Missing 'githubRepo' or 'runId' in request body",
        }),
        { headers: corsHeaders, status: 400 }
      );
    }

    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");

    if (!GITHUB_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Missing GITHUB_TOKEN" }),
        { headers: corsHeaders, status: 500 }
      );
    }

    const { githubRepo, runId } = body;

    // Get workflow run details
    const runUrl = `https://api.github.com/repos/${githubRepo}/actions/runs/${runId}`;
    const runResponse = await fetch(runUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
      },
    });

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      return new Response(
        JSON.stringify({
          error: "Failed to fetch workflow run",
          status: runResponse.status,
          details: errorText,
        }),
        { headers: corsHeaders, status: runResponse.status }
      );
    }

    const runData = await runResponse.json();

    // Get jobs for this run
    const jobsUrl = `https://api.github.com/repos/${githubRepo}/actions/runs/${runId}/jobs`;
    const jobsResponse = await fetch(jobsUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
      },
    });

    if (!jobsResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch jobs" }),
        { headers: corsHeaders, status: jobsResponse.status }
      );
    }

    const jobsData = await jobsResponse.json();

    // Parse logs from all jobs
    const logs: any[] = [];
    
    for (const job of jobsData.jobs || []) {
      // Add job start entry
      logs.push({
        timestamp: job.started_at || job.created_at,
        message: `▶️ Job started: ${job.name}`,
        level: "info",
        step: job.name,
      });

      // Add step entries
      for (const step of job.steps || []) {
        const level = 
          step.conclusion === "failure" ? "error" :
          step.conclusion === "success" ? "info" : "info";

        const icon = 
          step.conclusion === "failure" ? "❌" :
          step.conclusion === "success" ? "✅" :
          step.status === "in_progress" ? "⏳" : "⏸";

        logs.push({
          timestamp: step.started_at || new Date().toISOString(),
          message: `${icon} ${step.name}: ${step.conclusion || step.status}`,
          level,
          step: step.name,
        });
      }

      // Add job completion entry
      if (job.conclusion) {
        const icon = job.conclusion === "success" ? "✅" : "❌";
        logs.push({
          timestamp: job.completed_at || new Date().toISOString(),
          message: `${icon} Job ${job.conclusion}: ${job.name}`,
          level: job.conclusion === "failure" ? "error" : "info",
          step: job.name,
        });
      }
    }

    // Sort logs by timestamp
    logs.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return new Response(
      JSON.stringify({
        ok: true,
        logs,
        workflowRun: {
          id: runData.id,
          status: runData.status,
          conclusion: runData.conclusion,
          html_url: runData.html_url,
          run_number: runData.run_number,
          created_at: runData.created_at,
          updated_at: runData.updated_at,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err: any) {
    console.error("❌ github-workflow-logs error", err?.message ?? err);

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
      }
    );
  }
});
