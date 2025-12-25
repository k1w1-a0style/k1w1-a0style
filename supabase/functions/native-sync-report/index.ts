import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

type Body = { jobId: string };

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = (await req.json().catch(() => null)) as Body | null;
    const jobId = String(body?.jobId ?? "").trim();
    if (!jobId) return errorResponse("Missing jobId", req, 400);
    if (!isUuid(jobId))
      return errorResponse("Invalid jobId (uuid expected)", req, 400);

    const SUPABASE_URL = Deno.env.get("K1W1_SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("K1W1_SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return errorResponse(
        "Missing K1W1_SUPABASE_URL or K1W1_SUPABASE_SERVICE_ROLE_KEY",
        req,
        500,
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const r = await supabase
      .from("native_sync_reports")
      .select("*")
      .eq("job_id", jobId)
      .single();

    if (r.error || !r.data) {
      return errorResponse("Report not found", req, 404);
    }

    return jsonResponse({ ok: true, reportRow: r.data }, req, 200);
  } catch (err: any) {
    return errorResponse("native-sync-report error", req, 500, {
      message: err?.message ?? String(err),
    });
  }
});
