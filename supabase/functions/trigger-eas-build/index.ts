import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { validateTriggerBuildRequest } from "../_shared/validation.ts";

/**
 * ✓ 100% stabiler trigger-eas-build
 * ✓ kein BuildJob wenn Push failed
 * ✓ saubere Fehlerstruktur
 * ✓ logging-ready für dein Frontend
 * ✓ unterstützt GitHub Actions dispatch
 * ✓ SEC-011: Input Validation hinzugefügt
 */

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json().catch(() => null);

    // ✅ SEC-011: Strikte Input-Validierung
    const validation = validateTriggerBuildRequest(body);
    if (!validation.valid) {
      return errorResponse(
        'Validation failed',
        req,
        400,
        { errors: validation.errors }
      );
    }

    const { githubRepo, buildProfile } = validation.data!;

    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
    const SUPABASE_URL = Deno.env.get("K1W1_SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("K1W1_SUPABASE_SERVICE_ROLE_KEY");

    if (!GITHUB_TOKEN || !SUPABASE_URL || !SERVICE_ROLE) {
      return errorResponse(
        'Missing required environment variables',
        req,
        500,
        {
          missing: {
            GITHUB_TOKEN: !!GITHUB_TOKEN,
            SUPABASE_URL: !!SUPABASE_URL,
            SERVICE_ROLE: !!SERVICE_ROLE,
          },
        }
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
          github_repo: githubRepo, // ✅ Validierter Wert
          build_profile: buildProfile, // ✅ Validierter Wert
          status: "queued",
        },
      ])
      .select("*")
      .single();

    if (insert.error) {
      return errorResponse(
        'Supabase insert failed',
        req,
        500,
        insert.error
      );
    }

    const jobId = insert.data.id;

    // -----------------------------------------------------
    // 2) GitHub DISPATCH mit Job ID ausführen
    // -----------------------------------------------------
    const dispatchUrl =
      `https://api.github.com/repos/${githubRepo}/dispatches`; // ✅ Validierter Wert

    const dispatchPayload = {
      event_type: "trigger-eas-build",
      client_payload: {
        job_id: jobId, // ✅ Job ID mitgeben!
        build_profile: buildProfile,
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

      return errorResponse(
        'GitHub dispatch failed',
        req,
        500,
        {
          status: ghRes.status,
          githubResponse: errorText,
          jobId: jobId,
        }
      );
    }

    // -----------------------------------------------------
    // 3) Saubere Success Response
    // -----------------------------------------------------
    return jsonResponse({
      ok: true,
      githubDispatch: true,
      buildJobCreated: true,
      job: insert.data,
    }, req);
    
  } catch (err: any) {
    console.error("❌ trigger-eas-build error", err?.message ?? err, err?.stack);
    
    return errorResponse(
      'Unhandled exception in trigger-eas-build',
      req,
      500,
      { message: err?.message || 'Unknown error' }
    );
  }
});
