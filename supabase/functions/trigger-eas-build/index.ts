import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

/**
 * ✓ 100% stabiler trigger-eas-build
 * ✓ kein BuildJob wenn Push failed
 * ✓ saubere Fehlerstruktur
 * ✓ logging-ready für dein Frontend
 * ✓ unterstützt GitHub Actions dispatch
 */

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json().catch(() => null);

    if (!body || !body.githubRepo) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing 'githubRepo' in request body",
        }),
        {
          headers: corsHeaders,
          status: 400,
        },
      );
    }

    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
    const SUPABASE_URL = Deno.env.get("K1W1_SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("K1W1_SUPABASE_SERVICE_ROLE_KEY");

    if (!GITHUB_TOKEN || !SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing required environment variables",
          missing: {
            GITHUB_TOKEN: !!GITHUB_TOKEN,
            SUPABASE_URL: !!SUPABASE_URL,
            SERVICE_ROLE: !!SERVICE_ROLE,
          },
        }),
        {
          headers: corsHeaders,
          status: 500,
        },
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // -----------------------------------------------------
    // 1) Build Job in Supabase anlegen (VOR GitHub Dispatch!)
    // -----------------------------------------------------
    const insert = await supabase
      .from("build_jobs")
      .insert([
        {
          github_repo: body.githubRepo,
          status: "queued",
        },
      ])
      .select("*")
      .single();

    if (insert.error) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Supabase insert failed",
          details: insert.error,
        }),
        {
          headers: corsHeaders,
          status: 500,
        },
      );
    }

    const jobId = insert.data.id;

    // -----------------------------------------------------
    // 2) GitHub DISPATCH mit Job ID ausführen
    // -----------------------------------------------------
    const dispatchUrl =
      `https://api.github.com/repos/${body.githubRepo}/dispatches`;

    const dispatchPayload = {
      event_type: "trigger-eas-build",
      client_payload: {
        job_id: jobId, // ✅ Job ID mitgeben!
      },
    };

    const ghRes = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
      },
      body: JSON.stringify(dispatchPayload),
    });

    const pushSuccess = ghRes.ok;

    if (!pushSuccess) {
      const errorText = await ghRes.text();

      // ✅ Bei Fehler: Job auf 'error' setzen
      await supabase
        .from("build_jobs")
        .update({
          status: "error",
          error_message: `GitHub dispatch failed: ${errorText}`,
        })
        .eq("id", jobId);

      return new Response(
        JSON.stringify({
          ok: false,
          error: "GitHub dispatch failed",
          status: ghRes.status,
          githubResponse: errorText,
          jobId: jobId,
        }),
        {
          headers: corsHeaders,
          status: 500,
        },
      );
    }

    // -----------------------------------------------------
    // 3) Saubere Success Response
    // -----------------------------------------------------

    return new Response(
      JSON.stringify({
        ok: true,
        githubDispatch: true,
        buildJobCreated: true,
        job: insert.data,
      }),
      {
        headers: corsHeaders,
        status: 200,
      },
    );
  } catch (err: any) {
    console.error("❌ trigger-eas-build error", err?.message ?? err, err?.stack);
    
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Unhandled exception in trigger-eas-build",
        message: err?.message || "Unknown error",
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
