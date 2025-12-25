import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

type ReqBody = { jobId?: string | number };

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = (await req.json().catch(() => ({}))) as ReqBody;
    const jobId = Number(body.jobId);

    if (!Number.isFinite(jobId) || jobId <= 0) {
      return errorResponse("Validation failed: jobId invalid", req, 400);
    }

    const SUPABASE_URL = Deno.env.get("K1W1_SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("K1W1_SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE)
      return errorResponse("Missing env", req, 500);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const res = await supabase
      .from("native_sync_reports")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (res.error)
      return errorResponse("Report lookup failed", req, 500, res.error);

    return jsonResponse({ ok: true, report: res.data ?? null }, req);
  } catch (err: any) {
    console.error(
      "❌ native-sync-report error",
      err?.message ?? err,
      err?.stack,
    );
    return errorResponse(err?.message || "Unknown error", req, 500);
  }
});
