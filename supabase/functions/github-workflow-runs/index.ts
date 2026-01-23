import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAdminKey, rateLimit } from "../_shared/auth.ts";
import { githubHeaders } from "../_shared/github.ts";

/**
 * Lists GitHub Actions workflow runs.
 *
 * Input (JSON body) supports multiple aliases:
 * - githubRepo: "owner/repo"  (aliases: github_repo, repoFullName, fullName, repository, githubRepository)
 * - owner + repo (fallback)
 * - workflowId: workflow filename (e.g. "k1w1-triggered-build.yml") OR numeric workflow id
 *   aliases: workflow_id, workflowFile, workflow_file, workflow, path
 * - perPage (aliases: per_page)
 * - ref/branch (aliases: head_branch)
 * - event (optional)
 *
 * Output is **sanitized** (no huge nested repo objects / no emails).
 */
function pickString(
  obj: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const k of keys) {
    const v = (obj as any)?.[k];
    if (typeof v === "string") {
      const s = v.trim();
      if (s) return s;
    }
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

function pickInt(
  obj: Record<string, unknown>,
  keys: string[],
  fallback: number,
): number {
  for (const k of keys) {
    const v = (obj as any)?.[k];
    const n =
      typeof v === "number"
        ? v
        : typeof v === "string"
          ? Number.parseInt(v, 10)
          : NaN;
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  // Edge Runtime sometimes sends weird/missing content-type; be tolerant.
  const txt = await req.text();
  if (!txt) return {};
  try {
    const parsed = JSON.parse(txt);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function splitRepo(githubRepo: string): { owner: string; repo: string } | null {
  const s = githubRepo.trim();
  const m = /^([^/]+)\/([^/]+)$/.exec(s);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function sanitizeRun(r: any) {
  return {
    id: r?.id ?? null,
    html_url: r?.html_url ?? null,
    status: r?.status ?? null,
    conclusion: r?.conclusion ?? null,
    created_at: r?.created_at ?? null,
    updated_at: r?.updated_at ?? null,
    run_started_at: r?.run_started_at ?? null,
    head_branch: r?.head_branch ?? null,
    head_sha: r?.head_sha ?? null,
    event: r?.event ?? null,
    name: r?.name ?? null,
    path: r?.path ?? null,
    workflow_id: r?.workflow_id ?? null,
    run_number: r?.run_number ?? null,
    display_title: r?.display_title ?? r?.name ?? null,
    actor: r?.actor?.login ?? null,
    triggering_actor: r?.triggering_actor?.login ?? null,
  };
}

serve(async (req: Request) => {
  try {
    const cors = handleCors(req);
    if (cors) return cors;

    // Admin gate + rate limiting (keeps this endpoint private)
    requireAdminKey(req);
    await rateLimit(req, {
      bucket: "github-workflow-runs",
      limit: 60,
      windowMs: 60_000,
    });

    const body = req.method === "GET" ? {} : await readJsonBody(req);

    const githubRepo =
      pickString(body, [
        "githubRepo",
        "github_repo",
        "repoFullName",
        "repo_full_name",
        "fullName",
        "full_name",
        "repository",
        "githubRepository",
        "github_repository",
      ]) ??
      (() => {
        const owner = pickString(body, ["owner"]);
        const repo = pickString(body, ["repo"]);
        return owner && repo ? `${owner}/${repo}` : undefined;
      })();

    if (!githubRepo) {
      return jsonResponse(400, {
        ok: false,
        error: "Validation failed",
        details: { error: "githubRepo must be a string" },
      });
    }

    const repoParts = splitRepo(githubRepo);
    if (!repoParts) {
      return jsonResponse(400, {
        ok: false,
        error: "Validation failed",
        details: { error: "githubRepo must be in form 'owner/repo'" },
      });
    }

    const workflowId = pickString(body, [
      "workflowId",
      "workflow_id",
      "workflowFile",
      "workflow_file",
      "workflow",
      "workflowName",
      "workflow_name",
      "path",
    ]);

    const perPage = Math.min(100, pickInt(body, ["perPage", "per_page"], 10));
    const ref = pickString(body, ["ref", "branch", "head_branch"]);
    const event = pickString(body, ["event"]);

    const { owner, repo } = repoParts;

    const base = workflowId
      ? `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflowId)}/runs`
      : `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs`;

    const qs = new URLSearchParams();
    qs.set("per_page", String(perPage));
    if (ref) qs.set("branch", ref);
    if (event) qs.set("event", event);

    const url = `${base}?${qs.toString()}`;

    const gh = await fetch(url, {
      method: "GET",
      headers: {
        ...githubHeaders(),
        accept: "application/vnd.github+json",
      },
    });

    const raw = await gh.text();
    if (!gh.ok) {
      return jsonResponse(gh.status, {
        ok: false,
        error: "GitHub workflow runs fetch failed",
        details: { status: gh.status, body: raw.slice(0, 2000) },
      });
    }

    let data: any = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = {};
    }

    const workflowRuns = Array.isArray(data?.workflow_runs)
      ? data.workflow_runs
      : [];
    const runs = workflowRuns.map(sanitizeRun);

    return jsonResponse(200, {
      ok: true,
      githubRepo,
      workflowId: workflowId ?? null,
      perPage,
      ref: ref ?? null,
      event: event ?? null,
      total_count:
        typeof data?.total_count === "number" ? data.total_count : runs.length,
      runs,
    });
  } catch (e) {
    return jsonResponse(500, {
      ok: false,
      error: "Unhandled error",
      details: { message: String(e?.message ?? e) },
    });
  }
});
