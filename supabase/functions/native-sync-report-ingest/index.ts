import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

type ReqBody = {
  jobId?: string;
  githubRepo?: string;
  report?: any;
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // simple shared secret (for GitHub workflow)
    const expected = Deno.env.get("K1W1_SYNC_SECRET") || "";
    const got = req.headers.get("x-k1w1-sync-secret") || "";
    if (!expected || got !== expected) {
      return errorResponse("Forbidden", req, 403);
    }

    const body = (await req.json().catch(() => ({}))) as ReqBody;
    const jobId = Number(body.jobId);
    const githubRepo = String(body.githubRepo || "").trim();
    const report = body.report;

    if (!Number.isFinite(jobId) || jobId <= 0) {
      return errorResponse("Validation failed: jobId invalid", req, 400);
    }
    if (!report)
      return errorResponse("Validation failed: report missing", req, 400);

    const SUPABASE_URL = Deno.env.get("K1W1_SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("K1W1_SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE)
      return errorResponse("Missing env", req, 500);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // store report
    const ins = await supabase
      .from("native_sync_reports")
      .insert([{ job_id: jobId, report }])
      .select("*")
      .single();

    if (ins.error)
      return errorResponse("Insert report failed", req, 500, ins.error);

    // update job status (best-effort)
    const ok = report?.ok === true;
    const missingCount = Number(
      report?.stats?.missingPackages ?? report?.missing?.deps?.length ?? 0,
    );
    const status = ok ? "success" : "failed";

    await supabase
      .from("native_sync_jobs")
      .update({
        status,
        github_repo: githubRepo || undefined,
        last_error: ok ? null : "native sync failed (see report.errors)",
      })
      .eq("id", jobId);

    return jsonResponse(
      { ok: true, stored: ins.data, status, missingCount },
      req,
    );
  } catch (err: any) {
    console.error(
      "❌ native-sync-report-ingest error",
      err?.message ?? err,
      err?.stack,
    );
    return errorResponse(err?.message || "Unknown error", req, 500);
  }
});
