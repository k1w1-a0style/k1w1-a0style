import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

type Body = {
  jobId: string;
  githubRepo: string;
  report: unknown; // JSON object
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const SECRET = Deno.env.get("K1W1_SYNC_SECRET") || "";
    if (SECRET) {
      const hdr = req.headers.get("x-k1w1-sync-secret") || "";
      if (hdr !== SECRET) {
        return errorResponse("Unauthorized", req, 401);
      }
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body?.jobId || !body?.githubRepo || !body?.report) {
      return errorResponse("Missing jobId/githubRepo/report", req, 400);
    }
    if (!isUuid(body.jobId)) {
      return errorResponse("Invalid jobId (uuid expected)", req, 400);
    }
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(body.githubRepo)) {
      return errorResponse(
        "Invalid githubRepo (owner/repo expected)",
        req,
        400,
      );
    }
    if (typeof body.report !== "object" || body.report === null) {
      return errorResponse("report must be a JSON object", req, 400);
    }

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

    // Upsert report
    const up = await supabase
      .from("native_sync_reports")
      .upsert(
        {
          job_id: body.jobId,
          github_repo: body.githubRepo,
          report: body.report,
        },
        { onConflict: "job_id" },
      )
      .select("*")
      .single();

    if (up.error) {
      return errorResponse(
        "Upsert failed (native_sync_reports)",
        req,
        500,
        up.error,
      );
    }

    return jsonResponse({ ok: true, saved: true, row: up.data }, req, 200);
  } catch (err: any) {
    return errorResponse("native-sync-report-ingest error", req, 500, {
      message: err?.message ?? String(err),
    });
  }
});
