import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return new Response(
        JSON.stringify({ error: "Missing request body" }),
        { headers: corsHeaders, status: 400 },
      );
    }

    // Akzeptiere sowohl githubRepo als auch repoFullName (Kompatibilität)
    const githubRepo = body.githubRepo ?? body.repoFullName;
    const easProjectId =
      typeof body.easProjectId === "string" && body.easProjectId.trim().length
        ? body.easProjectId.trim()
        : null;
    const easToken =
      typeof body.easToken === "string" && body.easToken.trim().length
        ? body.easToken.trim()
        : null;
    const platform =
      typeof body.platform === "string" && body.platform.trim().length
        ? body.platform.trim()
        : null;
    const profile =
      typeof body.profile === "string" && body.profile.trim().length
        ? body.profile.trim()
        : null;

    if (!githubRepo) {
      return new Response(
        JSON.stringify({
          error: "Missing 'githubRepo' or 'repoFullName' in request body",
        }),
        { headers: corsHeaders, status: 400 },
      );
    }

    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
    const SUPABASE_URL = Deno.env.get("K1W1_SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("K1W1_SUPABASE_SERVICE_ROLE_KEY");

    if (!GITHUB_TOKEN || !SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(
        JSON.stringify({
          error: "Missing required environment variables",
          missing: {
            GITHUB_TOKEN: !!GITHUB_TOKEN,
            SUPABASE_URL: !!SUPABASE_URL,
            SERVICE_ROLE: !!SERVICE_ROLE,
          },
        }),
        { headers: corsHeaders, status: 500 },
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1) Build-Job zuerst anlegen
    const insert = await supabase
      .from("build_jobs")
      .insert([{ github_repo: githubRepo, status: "pending" }])
      .select("*")
      .single();

    if (insert.error) {
      return new Response(
        JSON.stringify({
          error: "Supabase insert failed",
          details: insert.error,
        }),
        { headers: corsHeaders, status: 500 },
      );
    }

    const jobId = insert.data.id;

    // 2) GitHub Dispatch mit job_id im Payload
    const dispatchUrl =
      `https://api.github.com/repos/${githubRepo}/dispatches`;

    const dispatchPayload = {
      event_type: "trigger-eas-build",
      client_payload: {
        job_id: jobId,
        repo: githubRepo,
        eas_project_id: easProjectId,
        eas_token: easToken,
        platform,
        profile,
      },
    };

    const ghRes = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dispatchPayload),
    });

    if (!ghRes.ok) {
      const errorText = await ghRes.text();

      // Cleanup: Job auf "error" setzen
      await supabase
        .from("build_jobs")
        .update({
          status: "error",
          error_message: `GitHub Dispatch failed: ${errorText}`,
        })
        .eq("id", jobId);

      return new Response(
        JSON.stringify({
          error: "GitHub dispatch failed",
          status: ghRes.status,
          githubResponse: errorText,
        }),
        { headers: corsHeaders, status: 500 },
      );
    }

    // 3) Erfolgreiche Antwort
    return new Response(
      JSON.stringify({
        ok: true,
        jobId: jobId, // Konsistent mit BuildScreenV2 Erwartung
        job_id: jobId, // Legacy-Kompatibilität
        github_repo: githubRepo,
        message: "Build job created and GitHub Actions triggered",
      }),
      { headers: corsHeaders, status: 200 },
    );
  } catch (err: any) {
    console.error("❌ trigger-eas-build error:", err);
    return new Response(
      JSON.stringify({
        error: "Unhandled exception",
        message: err?.message,
      }),
      { headers: corsHeaders, status: 500 },
    );
  }
});
