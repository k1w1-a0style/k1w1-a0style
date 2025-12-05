import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Triggers a GitHub Actions workflow via workflow_dispatch
 * Allows manual triggering of workflows from the app
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);

    if (!body || !body.githubRepo || !body.workflowId) {
      return new Response(
        JSON.stringify({
          error: "Missing 'githubRepo' or 'workflowId' in request body",
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

    const { githubRepo, workflowId, ref = "main", inputs = {} } = body;

    // Trigger workflow dispatch
    const dispatchUrl = `https://api.github.com/repos/${githubRepo}/actions/workflows/${workflowId}/dispatches`;
    
    const dispatchResponse = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref,
        inputs,
      }),
    });

    if (!dispatchResponse.ok) {
      const errorText = await dispatchResponse.text();
      return new Response(
        JSON.stringify({
          error: "Failed to trigger workflow",
          status: dispatchResponse.status,
          details: errorText,
        }),
        { headers: corsHeaders, status: dispatchResponse.status }
      );
    }

    // GitHub returns 204 No Content on success
    return new Response(
      JSON.stringify({
        ok: true,
        message: "Workflow triggered successfully",
        githubRepo,
        workflowId,
        ref,
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
    console.error("❌ github-workflow-dispatch error", err?.message ?? err);

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
