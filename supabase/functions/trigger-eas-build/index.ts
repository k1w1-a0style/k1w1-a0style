import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { requireAdminKey, rateLimit } from "../_shared/auth.ts";
import {
  parseJsonBody,
  validateTriggerBuildRequest,
} from "../_shared/validation.ts";
import { githubHeaders } from "../_shared/github.ts";

/**
 * Creates a build_jobs row and triggers the GitHub repository_dispatch event (trigger-eas-build).
 *
 * Contract:
 * - Input: { githubRepo, buildProfile, branch? }
 * - Output: { ok, job {id,...}, dispatch { ok, status } }
 *
 * Security:
 * - Admin key gate (if configured)
 * - Rate limit
 * - Strict input validation + body size limit
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const auth = requireAdminKey(req);
  if (auth) return auth;

  const rl = rateLimit(req, "trigger-eas-build");
  if (rl) return rl;

  try {
    const body = await parseJsonBody(req, 30 * 1024); // 30 KiB

    const validation = validateTriggerBuildRequest(body);
    if (!validation.valid) {
      return errorResponse("Validation failed", req, 400, {
        errors: validation.errors,
      });
    }

    const { githubRepo, buildProfile, branch } = validation.data!;

    const SUPABASE_URL = Deno.env.get("K1W1_SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("K1W1_SUPABASE_SERVICE_ROLE_KEY");
    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");

    if (!SUPABASE_URL || !SERVICE_ROLE || !GITHUB_TOKEN) {
      return errorResponse("Missing required environment variables", req, 500, {
        missing: {
          SUPABASE_URL: !!SUPABASE_URL,
          SERVICE_ROLE: !!SERVICE_ROLE,
          GITHUB_TOKEN: !!GITHUB_TOKEN,
        },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1) Create build job row (queued)
    const insert = await supabase
      .from("build_jobs")
      .insert([
        {
          github_repo: githubRepo,
          build_profile: buildProfile,
          status: "queued",
          branch: branch ?? null,
        },
      ])
      .select("*")
      .single();

    if (insert.error) {
      return errorResponse("Supabase insert failed", req, 500, insert.error);
    }

    const jobId = insert.data.id as number;

    // 2) Dispatch to GitHub
    const dispatchUrl = `https://api.github.com/repos/${githubRepo}/dispatches`;

    const dispatchPayload = {
      event_type: "trigger-eas-build",
      client_payload: {
        job_id: jobId,
        buildProfile: buildProfile, // RN compatibility
        build_profile: buildProfile,
        branch: branch ?? null,
        ref: branch ?? null, // allow workflow to use as checkout ref
      },
    };

    const ghRes = await fetch(dispatchUrl, {
      method: "POST",
      headers: githubHeaders(GITHUB_TOKEN),
      body: JSON.stringify(dispatchPayload),
    });

    if (!ghRes.ok) {
      const errorText = await ghRes.text().catch(() => "");
      // mark job error
      await supabase
        .from("build_jobs")
        .update({
          status: "error",
          error_message:
            `GitHub dispatch failed (${ghRes.status}): ${errorText}`.slice(
              0,
              2000,
            ),
        })
        .eq("id", jobId);

      return errorResponse("GitHub dispatch failed", req, 502, {
        status: ghRes.status,
        body: errorText,
        jobId,
      });
    }

    return jsonResponse(
      {
        ok: true,
        job: insert.data,
        dispatch: {
          ok: true,
          status: ghRes.status,
        },
      },
      req,
      200,
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
