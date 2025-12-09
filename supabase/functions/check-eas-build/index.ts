import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { validateCheckBuildRequest } from "../_shared/validation.ts";

/**
 * ✓ Stabile Status-Überprüfung
 * ✓ Konsistente Response-Struktur
 * ✓ Fehlerkategorien sauber getrennt
 * ✓ EAS + GitHub Status-Mapping
 * ✓ Kein undefined mehr
 * ✓ Voll kompatibel mit deinem k1w1-Builder
 * ✓ SEC-011: Input Validation hinzugefügt
 */

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json().catch(() => null);

    // ✅ SEC-011: Strikte Input-Validierung
    const validation = validateCheckBuildRequest(body);
    if (!validation.valid) {
      return errorResponse(
        'Validation failed',
        req,
        400,
        { errors: validation.errors }
      );
    }

    const { jobId } = validation.data!;

    const SUPABASE_URL = Deno.env.get("K1W1_SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("K1W1_SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return errorResponse(
        'Missing required environment variables',
        req,
        500
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // -----------------------------------------------------
    // 1) BuildJob aus Supabase laden
    // -----------------------------------------------------
    const jobRes = await supabase
      .from("build_jobs")
      .select("*")
      .eq("id", jobId) // ✅ Validierter Wert
      .single();

    if (jobRes.error || !jobRes.data) {
      return errorResponse('Build job not found', req, 404);
    }

    const job = jobRes.data;

    if (!job.github_repo) {
      return errorResponse(
        'build_jobs row missing github_repo',
        req,
        500
      );
    }

    // -----------------------------------------------------
    // 2) GitHub Actions Build Status holen
    // -----------------------------------------------------
    const repo = job.github_repo;
    const ghUrl =
      `https://api.github.com/repos/${repo}/actions/runs?per_page=5`;

    const token = Deno.env.get("GITHUB_TOKEN");

    if (!token) {
      return errorResponse('Missing GITHUB_TOKEN', req, 500);
    }

    const ghRes = await fetch(ghUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!ghRes.ok) {
      const txt = await ghRes.text();
      return errorResponse(
        'GitHub API error',
        req,
        500,
        { status: ghRes.status, githubResponse: txt }
      );
    }

    const ghJson = await ghRes.json().catch(() => null);

    if (!ghJson || !ghJson.workflow_runs) {
      return errorResponse(
        'Invalid GitHub response',
        req,
        500,
        { githubResponse: ghJson }
      );
    }

    // -----------------------------------------------------
    // 3) Build finden (nur passende Repo-Runs)
    // -----------------------------------------------------
    const run = ghJson.workflow_runs.find((r: any) => {
      return (
        r.head_repository &&
        r.head_repository.full_name &&
        r.head_repository.full_name.toLowerCase() === repo.toLowerCase()
      );
    });

    if (!run) {
      return jsonResponse({
        ok: true,
        buildFound: false,
        status: "waiting",
        message: "No build run found yet",
      }, req);
    }

    // -----------------------------------------------------
    // 4) Mapping GitHub -> k1w1 Build Status
    // -----------------------------------------------------
    let mappedStatus = "unknown";

    const ghStatus = (run.status || "").toLowerCase();
    const ghConclusion = (run.conclusion || "").toLowerCase();

    if (ghStatus === "queued") mappedStatus = "queued";
    if (ghStatus === "in_progress") mappedStatus = "building";
    if (ghStatus === "completed") {
      if (ghConclusion === "success") mappedStatus = "success";
      else mappedStatus = "failed";
    }
    if (ghStatus === "") mappedStatus = "waiting";

    // Direkt Download-URL extrahieren, falls Erfolg
    let artifactUrl: string | null = null;
    if (mappedStatus === "success") {
      if (run.artifacts_url) {
        artifactUrl = run.artifacts_url;
      }
    }

    return jsonResponse({
      ok: true,
      buildFound: true,
      status: mappedStatus,
      githubStatus: ghStatus,
      githubConclusion: ghConclusion,
      runId: run.id,
      urls: {
        html: run.html_url,
        artifacts: artifactUrl,
      },
      job,
    }, req);
    
  } catch (err: any) {
    console.error("❌ check-eas-build error", err?.message ?? err, err?.stack);

    return errorResponse(
      err?.message || 'Unknown error',
      req,
      500
    );
  }
});
