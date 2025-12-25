import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

type ReqBody = {
  githubRepo?: string;
  ref?: string;
  apply?: string | boolean;
  create_pr?: string | boolean;
  base_ref?: string;
};

function toBool(v: any, def = false) {
  if (v === true || v === "true" || v === "1" || v === 1) return true;
  if (v === false || v === "false" || v === "0" || v === 0) return false;
  return def;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = (await req.json().catch(() => ({}))) as ReqBody;

    const githubRepo = String(body.githubRepo || "").trim();
    if (!githubRepo || !githubRepo.includes("/")) {
      return errorResponse(
        "Validation failed: githubRepo missing/invalid",
        req,
        400,
      );
    }

    const ref = String(body.ref || "main");
    const baseRef = String(body.base_ref || "main");
    const apply = toBool(body.apply, true);
    const createPr = toBool(body.create_pr, false);

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

    // 1) job anlegen
    const ins = await supabase
      .from("native_sync_jobs")
      .insert([{ github_repo: githubRepo, status: "queued" }])
      .select("*")
      .single();

    if (ins.error || !ins.data) {
      return errorResponse("Supabase insert failed", req, 500, ins.error);
    }

    const jobId = ins.data.id;

    // 2) dispatch workflow
    const workflowId = "k1w1-sync-native.yml";
    const dispatchUrl = `https://api.github.com/repos/${githubRepo}/actions/workflows/${workflowId}/dispatches`;

    const dispatchRes = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref,
        inputs: {
          apply: apply ? "true" : "false",
          create_pr: createPr ? "true" : "false",
          base_ref: baseRef,
          job_id: String(jobId),
        },
      }),
    });

    if (!dispatchRes.ok) {
      const txt = await dispatchRes.text().catch(() => "");
      await supabase
        .from("native_sync_jobs")
        .update({
          status: "error",
          last_error: `dispatch failed: ${txt || dispatchRes.status}`,
        })
        .eq("id", jobId);

      return errorResponse("GitHub workflow_dispatch failed", req, 500, {
        status: dispatchRes.status,
        details: txt,
        jobId,
      });
    }

    await supabase
      .from("native_sync_jobs")
      .update({ status: "dispatched" })
      .eq("id", jobId);

    return jsonResponse(
      {
        ok: true,
        jobId,
        githubRepo,
        workflow: workflowId,
      },
      req,
    );
  } catch (err: any) {
    console.error(
      "❌ trigger-native-sync error",
      err?.message ?? err,
      err?.stack,
    );
    return errorResponse(
      "Unhandled exception in trigger-native-sync",
      req,
      500,
      {
        message: err?.message || "Unknown error",
      },
    );
  }
});
