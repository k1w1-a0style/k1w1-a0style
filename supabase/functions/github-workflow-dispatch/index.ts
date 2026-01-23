import {
  parseJsonBody,
  serve,
} from "https://deno.land/std@0.208.0/http/server.ts";
import { parseJsonBody, corsHeaders, handleCors } from "../_shared/cors.ts";
import { parseJsonBody, requireAdminKey, rateLimit } from "../_shared/auth.ts";
import { parseJsonBody, githubHeaders } from "../_shared/github.ts";

/**
 * Triggers a GitHub Actions workflow via workflow_dispatch
 * Allows manual triggering of workflows from the app
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const auth = requireAdminKey(req);
  if (auth) return auth;

  const rl = rateLimit(req, "github-workflow-dispatch");
  if (rl) return rl;

  try {
    const body = await req.json().catch(() => null);

    if (!body || !body.githubRepo || !body.workflowId) {
      return new Response(
        JSON.stringify({
          error: "Missing 'githubRepo' or 'workflowId' in request body",
        }),
        { headers: corsHeaders, status: 400 },
      );
    }
    const githubToken = String(body.githubToken || "").trim();
    const token = githubToken || Deno.env.get("GITHUB_TOKEN") || "";
    if (!token) {
      return new Response(
        JSON.stringify({
          error: "Missing GITHUB_TOKEN (set secret or provide githubToken)",
        }),
        { headers: corsHeaders, status: 500 },
      );
    }

    const { githubRepo, workflowId, ref = "main", inputs = {} } = body;

    // Trigger workflow dispatch
    const dispatchUrl = `https://api.github.com/repos/${githubRepo}/actions/workflows/${workflowId}/dispatches`;

    const dispatchResponse = await fetch(dispatchUrl, {
      method: "POST",
      headers: githubHeaders(token),
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
        { headers: corsHeaders, status: dispatchResponse.status },
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
      },
    );
  } catch (err: any) {
    console.error(
      "❌ github-workflow-dispatch error",
      err?.message ?? err,
      err?.stack,
    );

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
