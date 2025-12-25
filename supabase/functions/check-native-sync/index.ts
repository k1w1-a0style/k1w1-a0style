import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

type CheckNativeSyncBody = {
  jobId: string;
};

function mapStatus(runStatus: string | null, conclusion: string | null) {
  const s = (runStatus || "").toLowerCase();
  if (s === "queued") return "running";
  if (s === "in_progress") return "running";
  if (s === "completed") {
    if ((conclusion || "").toLowerCase() === "success") return "success";
    if ((conclusion || "").toLowerCase() === "cancelled") return "error";
    if ((conclusion || "").toLowerCase() === "skipped") return "error";
    return "error";
  }
  return "running";
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = (await req
      .json()
      .catch(() => null)) as CheckNativeSyncBody | null;
    const jobId = String(body?.jobId ?? "").trim();

    if (!jobId) {
      return errorResponse("Missing jobId", req, 400);
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

    const jobRes = await supabase
      .from("build_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobRes.error || !jobRes.data) {
      return errorResponse(
        "Job not found (build_jobs)",
        req,
        404,
        jobRes.error,
      );
    }

    const job = jobRes.data;
    const githubRepo = String(job.github_repo || "").trim();
    if (!githubRepo) {
      return errorResponse("build_jobs row missing github_repo", req, 500);
    }

    const workflowId = "k1w1-sync-native.yml";
    const runsUrl = `https://api.github.com/repos/${githubRepo}/actions/workflows/${workflowId}/runs?per_page=20`;

    const ghRes = await fetch(runsUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
      },
    });

    if (!ghRes.ok) {
      const t = await ghRes.text();
      return errorResponse("GitHub runs fetch failed", req, 500, {
        status: ghRes.status,
        details: t,
      });
    }

    const ghJson = await ghRes.json().catch(() => null);
    const runs = ghJson?.workflow_runs || [];

    // We match by jobId embedded in run-name (display_title)
    const match =
      runs.find((r: any) => {
        const title = String(r?.display_title ?? "");
        return title.includes(jobId);
      }) ||
      runs[0] ||
      null;

    if (!match) {
      // still not visible -> keep queued/dispatched
      return jsonResponse(
        {
          ok: true,
          job: {
            id: jobId,
            status: job.status,
            error_message: job.error_message ?? null,
          },
          run: null,
          note: "No run found yet. GitHub may need a few seconds.",
        },
        req,
        200,
      );
    }

    const runStatus = String(match.status ?? "");
    const conclusion = match.conclusion ? String(match.conclusion) : null;
    const mapped = mapStatus(runStatus, conclusion);

    // Update minimal fields safely (status + error_message)
    const detail =
      `GitHub: ${runStatus}${conclusion ? ` / ${conclusion}` : ""} | ${match.html_url || ""}`.trim();

    await supabase
      .from("build_jobs")
      .update({
        status: mapped,
        error_message: mapped === "success" ? null : detail,
      })
      .eq("id", jobId);

    return jsonResponse(
      {
        ok: true,
        job: {
          id: jobId,
          status: mapped,
          error_message: mapped === "success" ? null : detail,
        },
        run: {
          id: match.id,
          status: match.status,
          conclusion: match.conclusion,
          html_url: match.html_url,
          run_number: match.run_number,
          created_at: match.created_at,
          updated_at: match.updated_at,
          display_title: match.display_title,
        },
      },
      req,
      200,
    );
  } catch (err: any) {
    return errorResponse("check-native-sync error", req, 500, {
      message: err?.message ?? String(err),
    });
  }
});
