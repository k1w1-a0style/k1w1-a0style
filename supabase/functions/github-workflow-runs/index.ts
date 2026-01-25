import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAdminKey, rateLimit } from "../_shared/auth.ts";
import { githubHeaders, getGithubToken } from "../_shared/github.ts";

/**
 * Lists GitHub Actions workflow runs.
 *
 * Input (JSON body) supports multiple aliases:
 * - githubRepo: "owner/repo"  (aliases: github_repo, repoFullName, fullName, repository, githubRepository)
 * - owner + repo (fallback)
 * - workflowId: workflow filename (e.g. "k1w1-triggered-build.yml") OR numeric workflow id
 *   aliases: workflow_id, workflowFile, workflow_file, workflow, path
 * - perPage (aliases: per_page)
 * - ref/branch (aliases: branch)
 * - status (optional)
 */
serve(async (req) => {
  if (handleCors(req)) return handleCors(req);

  try {
    const auth = requireAdminKey(req);
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

    const workflowId =
      body.workflowId ??
      body.workflow_id ??
      body.workflowFile ??
      body.workflow_file ??
      body.workflow ??
      body.path ??
      "";

    if (!workflowId || typeof workflowId !== "string") {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing/invalid workflowId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const perPageRaw = body.perPage ?? body.per_page ?? 20;
    const perPage = Math.max(1, Math.min(100, Number(perPageRaw) || 20));

    const ref = (body.ref ?? body.branch ?? "").toString().trim();
    const status = (body.status ?? "").toString().trim();

    const token = getGithubToken();
    if (!token) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing GitHub token",
          expected: ["GITHUB_TOKEN", "GH_TOKEN", "GITHUB_API_TOKEN"],
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

    const url =
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowId)}/runs?` +
      params.toString();

    const r = await fetch(url, {
      method: "GET",
      headers: githubHeaders(token),
    });

    const txt = await r.text();
    if (!r.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "GitHub API failed",
          status: r.status,
          body: txt.slice(0, 4000),
          url,
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
        JSON.stringify({ ok: false, error: "Invalid JSON from GitHub", url }),
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
      JSON.stringify({ ok: false, error: "Unexpected error", message: e?.message ?? String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
