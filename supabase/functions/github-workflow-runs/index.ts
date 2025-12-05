import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

/**
 * Fetches recent GitHub Actions workflow runs for a repository
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json().catch(() => null);

    if (!body || !body.githubRepo) {
      return new Response(
        JSON.stringify({
          error: "Missing 'githubRepo' in request body",
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

    const { githubRepo } = body;
    const perPage = body.perPage || 10;

    // Fetch workflow runs
    const runsUrl = `https://api.github.com/repos/${githubRepo}/actions/runs?per_page=${perPage}`;
    const runsResponse = await fetch(runsUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
      },
    });

    if (!runsResponse.ok) {
      const errorText = await runsResponse.text();
      return new Response(
        JSON.stringify({
          error: "Failed to fetch workflow runs",
          status: runsResponse.status,
          details: errorText,
        }),
        { headers: corsHeaders, status: runsResponse.status }
      );
    }

    const runsData = await runsResponse.json();

    // Map runs to simplified format
    const runs = (runsData.workflow_runs || []).map((run: any) => ({
      id: run.id,
      status: run.status,
      conclusion: run.conclusion,
      html_url: run.html_url,
      run_number: run.run_number,
      created_at: run.created_at,
      updated_at: run.updated_at,
      head_branch: run.head_branch,
      event: run.event,
      workflow_name: run.name,
    }));

    return new Response(
      JSON.stringify({
        ok: true,
        runs,
        total_count: runsData.total_count,
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
    console.error("❌ github-workflow-runs error", err?.message ?? err, err?.stack);

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
