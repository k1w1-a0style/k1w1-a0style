import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { validateTriggerBuildRequest } from "../_shared/validation.ts";

/**
 * trigger-eas-build (stabil)
 * - legt build_jobs row an
 * - triggert GitHub Actions via workflow_dispatch (passt zu eas-build.yml)
 * - gibt jobId zurück (für Chat/Status-Polling)
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json().catch(() => null);

    const validation = validateTriggerBuildRequest(body);
    if (!validation.valid) {
      return errorResponse("Validation failed", req, 400, {
        errors: validation.errors,
      });
    }

    const { githubRepo, buildProfile } = validation.data!;

    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
    const SUPABASE_URL = Deno.env.get("K1W1_SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("K1W1_SUPABASE_SERVICE_ROLE_KEY");

    if (!GITHUB_TOKEN || !SUPABASE_URL || !SERVICE_ROLE) {
      return errorResponse("Missing required environment variables", req, 500, {
        missing: {
          GITHUB_TOKEN: !!GITHUB_TOKEN,
          K1W1_SUPABASE_URL: !!SUPABASE_URL,
          K1W1_SUPABASE_SERVICE_ROLE_KEY: !!SERVICE_ROLE,
        },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1) Build Job anlegen
    const insert = await supabase
      .from("build_jobs")
      .insert([
        {
          github_repo: githubRepo,
          build_profile: buildProfile,
          status: "queued",
        },
      ])
      .select("*")
      .single();

    if (insert.error || !insert.data) {
      return errorResponse("Supabase insert failed", req, 500, insert.error);
    }

    const jobId = insert.data.id;

    // 2) workflow_dispatch trigger auf eas-build.yml
    const workflowId = "eas-build.yml";
    const dispatchUrl = `https://api.github.com/repos/${githubRepo}/actions/workflows/${workflowId}/dispatches`;

    const dispatchRes = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          profile: String(buildProfile),
          job_id: String(jobId),
        },
      }),
    });

    if (!dispatchRes.ok) {
      const txt = await dispatchRes.text().catch(() => "");
      await supabase
        .from("build_jobs")
        .update({
          status: "error",
          error_message: `GitHub workflow_dispatch failed: ${
            txt || dispatchRes.status
          }`,
        })
        .eq("id", jobId);

      return errorResponse("GitHub workflow_dispatch failed", req, 500, {
        status: dispatchRes.status,
        details: txt,
        jobId,
      });
    }

    // optional: mark dispatched
    await supabase
      .from("build_jobs")
      .update({ status: "dispatched" })
      .eq("id", jobId);

    return jsonResponse(
      {
        ok: true,
        workflow: workflowId,
        job: insert.data,
      },
      req,
    );
  } catch (err: any) {
    console.error(
      "❌ trigger-eas-build error",
      err?.message ?? err,
      err?.stack,
    );
    return errorResponse("Unhandled exception in trigger-eas-build", req, 500, {
      message: err?.message || "Unknown error",
    });
  }
});
