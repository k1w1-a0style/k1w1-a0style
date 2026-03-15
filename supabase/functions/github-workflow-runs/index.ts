import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAdminKeyOrServiceRoleBearer, rateLimit } from "../_shared/auth.ts";
import { githubHeaders, getGithubToken, GITHUB_API_BASE } from "../_shared/github.ts";
import { sanitizeErrorText, sanitizeGitHubFailure } from "../_shared/errorSanitization.ts";

/**
 * Lists GitHub Actions workflow runs.
 *
 * Input (JSON body) supports multiple aliases:
 * - githubRepo: "owner/repo"  (aliases: github_repo, repoFullName, fullName, repository, githubRepository)
 * - owner + repo (fallback)
 *
 * Optional:
 * - workflowId: workflow filename (e.g. "k1w1-triggered-build.yml") OR numeric workflow id
 *   aliases: workflow_id, workflowFile, workflow_file, workflow, path
 *   If omitted, falls back to listing *all* workflow runs for the repo.
 * - perPage (aliases: per_page)
 * - ref/branch (aliases: branch)
 * - status (optional)
 *
 * Optional auth passthrough (for private repos):
 * - githubToken / ghToken / token: client-provided PAT (only accepted if admin key is valid)
 */
serve(async (req) => {
    const cors = handleCors(req);
  if (cors) return cors;
try {
    const auth = requireAdminKeyOrServiceRoleBearer(req);
    if (auth) return auth;

    const rl = rateLimit(req, "github-workflow-runs");
    if (rl) return rl;

    const raw = await req.text();
    let body: any = {};
    if (raw?.trim()) {
      try {
        body = JSON.parse(raw);
      } catch {
        return new Response(
          JSON.stringify({ ok: false, error: "Invalid JSON body" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    const githubRepo =
      body.githubRepo ??
      body.github_repo ??
      body.repoFullName ??
      body.fullName ??
      body.repository ??
      body.githubRepository ??
      (body.owner && body.repo ? `${body.owner}/${body.repo}` : "");

    if (!githubRepo || typeof githubRepo !== "string" || !githubRepo.includes("/")) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing/invalid githubRepo" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const workflowIdRaw =
      body.workflowId ??
      body.workflow_id ??
      body.workflowFile ??
      body.workflow_file ??
      body.workflow ??
      body.path ??
      "";

    const workflowId = (typeof workflowIdRaw === "string" ? workflowIdRaw : "").trim();

    const perPageRaw = body.perPage ?? body.per_page ?? 20;
    const perPage = Math.max(1, Math.min(100, Number(perPageRaw) || 20));

    const ref = (body.ref ?? body.branch ?? "").toString().trim();
    const status = (body.status ?? "").toString().trim();

    const tokenFromBody = String(
      body.githubToken ?? body.ghToken ?? body.token ?? body.github_token ?? "",
    ).trim();
    const token = tokenFromBody || getGithubToken();
    if (!token) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing GitHub token",
          expected: ["GITHUB_TOKEN", "GH_TOKEN", "GITHUB_API_TOKEN", "githubToken (body)"],
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const [owner, repo] = githubRepo.split("/");
    const params = new URLSearchParams();
    params.set("per_page", String(perPage));
    if (ref) params.set("branch", ref);
    if (status) params.set("status", status);

    const repoRunsUrl =
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs?` + params.toString();

    const workflowRunsUrl =
      workflowId
        ? `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowId)}/runs?` +
          params.toString()
        : repoRunsUrl;

    // Primary fetch: workflow-specific (if workflowId given) else repo-wide.
    const r = await fetch(workflowRunsUrl, {
      method: "GET",
      headers: githubHeaders(token),
    });

    const txt = await r.text();

    // If workflow file/id is not found, fall back to repo-wide runs to keep UI usable.
    if (!r.ok && r.status === 404 && workflowId) {
      const r2 = await fetch(repoRunsUrl, {
        method: "GET",
        headers: githubHeaders(token),
      });
      const txt2 = await r2.text();
      if (!r2.ok) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "GitHub API failed",
            details: sanitizeGitHubFailure(r2, txt2),
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      let json2: any;
      try {
        json2 = JSON.parse(txt2);
      } catch {
        return new Response(
          JSON.stringify({ ok: false, error: "Invalid JSON from GitHub" }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          ok: true,
          data: json2,
          note: "workflowId not found; returned repo-wide workflow runs instead",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!r.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "GitHub API failed",
          details: sanitizeGitHubFailure(r, txt),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let json: any;
    try {
      json = JSON.parse(txt);
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid JSON from GitHub" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ ok: true, data: json }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Unexpected error",
        message: sanitizeErrorText(e?.message ?? String(e)),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
