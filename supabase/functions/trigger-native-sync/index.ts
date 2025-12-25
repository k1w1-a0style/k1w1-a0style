import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

type TriggerNativeSyncBody = {
  githubRepo: string;
  ref?: string;
  inputs?: {
    apply?: string; // "true" | "false"
    create_pr?: string; // "true" | "false"
    base_ref?: string; // branch
  };
};

function isValidRepo(repo: string) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo);
}

function normalizeBoolString(v: unknown, fallback: "true" | "false") {
  const s = String(v ?? "")
    .toLowerCase()
    .trim();
  if (s === "true" || s === "false") return s as "true" | "false";
  return fallback;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = (await req
      .json()
      .catch(() => null)) as TriggerNativeSyncBody | null;

    if (!body?.githubRepo || !isValidRepo(body.githubRepo)) {
      return errorResponse(
        "Invalid githubRepo (expected owner/repo)",
        req,
        400,
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return errorResponse(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
        req,
        500,
      );
    }
    if (!GITHUB_TOKEN) {
      return errorResponse("Missing GITHUB_TOKEN", req, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const githubRepo = body.githubRepo;
    const baseRef =
      String(body.inputs?.base_ref ?? body.ref ?? "main").trim() || "main";
    const apply = normalizeBoolString(body.inputs?.apply, "true");
    const create_pr = normalizeBoolString(body.inputs?.create_pr, "false");

    // 1) log job to Supabase (reusing existing build_jobs table)
    const insert = await supabase
      .from("build_jobs")
      .insert([
        {
          github_repo: githubRepo,
          build_profile: "native_sync",
          status: "queued",
        },
      ])
      .select("*")
      .single();

    if (insert.error || !insert.data?.id) {
      return errorResponse(
        "Supabase insert failed (build_jobs)",
        req,
        500,
        insert.error,
      );
    }

    const jobId = String(insert.data.id);

    // 2) dispatch workflow
    // We dispatch the existing workflow file (hard-coded to prevent abuse)
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
        ref: baseRef,
        inputs: {
          apply,
          create_pr,
          base_ref: baseRef,
          job_id: jobId,
        },
      }),
    });

    if (!dispatchRes.ok) {
      const errorText = await dispatchRes.text();

      await supabase
        .from("build_jobs")
        .update({
          status: "error",
          error_message: `GitHub dispatch failed: ${dispatchRes.status} ${errorText}`,
        })
        .eq("id", jobId);

      return errorResponse("GitHub dispatch failed", req, 500, {
        status: dispatchRes.status,
        details: errorText,
        jobId,
      });
    }

    // mark as dispatched
    await supabase
      .from("build_jobs")
      .update({
        status: "dispatched",
        error_message: null,
      })
      .eq("id", jobId);

    return jsonResponse(
      {
        ok: true,
        jobId,
        githubRepo,
        workflowId,
        ref: baseRef,
        inputs: { apply, create_pr, base_ref: baseRef },
      },
      req,
      200,
    );
  } catch (err: any) {
    return errorResponse("trigger-native-sync error", req, 500, {
      message: err?.message ?? String(err),
    });
  }
});
