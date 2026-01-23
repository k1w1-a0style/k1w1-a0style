import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAdminKey, rateLimit } from "../_shared/auth.ts";
import { githubHeaders } from "../_shared/github.ts";

type Json = Record<string, unknown>;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function toStringRecord(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (val === undefined || val === null) continue;
    // GitHub workflow_dispatch inputs must be strings
    out[String(k)] = typeof val === "string" ? val : String(val);
  }
  return out;
}

async function readJsonBody(
  req: Request,
  maxBytes = 128 * 1024,
): Promise<
  { ok: true; body: Json } | { ok: false; error: string; received?: string }
> {
  const ct = req.headers.get("content-type") || "";
  // Accept anything, but parse safely.
  const raw = await req.text();
  if (raw.length === 0) return { ok: true, body: {} };
  if (raw.length > maxBytes)
    return {
      ok: false,
      error: `Request body too large (${raw.length} bytes)`,
      received: raw.slice(0, 200),
    };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        ok: false,
        error: "JSON body must be an object",
        received: raw.slice(0, 200),
      };
    }
    return { ok: true, body: parsed as Json };
  } catch (_e) {
    return {
      ok: false,
      error: "Invalid JSON body",
      received: raw.slice(0, 200),
    };
  }
}

function normalizeRepo(body: Json): string | null {
  const githubRepo =
    body["githubRepo"] ??
    body["github_repo"] ??
    body["repoFullName"] ??
    body["fullRepo"] ??
    body["repository"];
  if (isNonEmptyString(githubRepo)) return githubRepo.trim();

  const owner = body["owner"] ?? body["githubOwner"];
  const repo = body["repo"] ?? body["githubRepoName"];
  if (isNonEmptyString(owner) && isNonEmptyString(repo))
    return `${owner.trim()}/${repo.trim()}`;

  return null;
}

function normalizeWorkflowId(body: Json): string | number | null {
  const v =
    body["workflowId"] ??
    body["workflow_id"] ??
    body["workflow"] ??
    body["workflowFile"] ??
    body["workflowFilename"];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (isNonEmptyString(v)) {
    const s = v.trim();
    // numeric string => treat as id
    if (/^\d+$/.test(s)) return Number(s);
    return s;
  }
  return null;
}

function normalizeRef(body: Json): string {
  const ref = body["ref"] ?? body["branch"] ?? body["gitRef"];
  if (isNonEmptyString(ref)) return ref.trim();
  return "main";
}

function getInputs(body: Json): Record<string, string> {
  return toStringRecord(body["inputs"]);
}

async function fetchJson(
  url: string,
  init: RequestInit,
): Promise<{ status: number; ok: boolean; text: string; json?: any }> {
  const res = await fetch(url, init);
  const text = await res.text();
  let j: any = undefined;
  try {
    j = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { status: res.status, ok: res.ok, text, json: j };
}

async function resolveWorkflow(
  token: string,
  owner: string,
  repo: string,
  workflowId: string | number,
): Promise<
  | { ok: true; workflow_id: number; name?: string; path?: string }
  | { ok: false; status: number; body: string; hint?: string }
> {
  // If already numeric id, use it directly
  if (typeof workflowId === "number")
    return { ok: true, workflow_id: workflowId };

  const key = workflowId.trim();

  // Fast path: if caller passed ".github/workflows/x.yml", dispatch accepts that string as {workflow_id} too.
  // But to avoid 404 ambiguity, we resolve via list.
  const listUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows`;
  const list = await fetchJson(listUrl, {
    method: "GET",
    headers: githubHeaders(token),
  });
  if (!list.ok) {
    return {
      ok: false,
      status: list.status,
      body: list.text,
      hint: "Failed to list workflows (token/repo permissions?)",
    };
  }

  const workflows: any[] = Array.isArray(list.json?.workflows)
    ? list.json.workflows
    : [];
  const lcKey = key.toLowerCase();

  const match = workflows.find((w) => {
    const name = typeof w?.name === "string" ? w.name.toLowerCase() : "";
    const path = typeof w?.path === "string" ? w.path.toLowerCase() : "";
    const id = typeof w?.id === "number" ? w.id : null;

    // exact name match
    if (name && name === lcKey) return true;

    // filename match: ends with "/<file>" or equals "<file>" or equals ".github/workflows/<file>"
    if (path) {
      if (path.endsWith("/" + lcKey)) return true;
      if (path === lcKey) return true;
      if (path === ".github/workflows/" + lcKey) return true;
    }

    // allow passing full path ".github/workflows/x.yml"
    if (key.startsWith(".github/workflows/") && path === key.toLowerCase())
      return true;

    // allow passing id as string (already filtered above)
    if (typeof id === "number" && String(id) === key) return true;

    return false;
  });

  if (!match || typeof match.id !== "number") {
    return {
      ok: false,
      status: 404,
      body: JSON.stringify({
        message: "Workflow not found",
        searched: key,
        available: workflows
          .map((w) => ({ id: w.id, name: w.name, path: w.path }))
          .slice(0, 50),
      }),
      hint: "workflowId must match workflow file name (e.g. k1w1-triggered-build.yml) or workflow name or numeric workflow id",
    };
  }

  return {
    ok: true,
    workflow_id: match.id,
    name: match.name,
    path: match.path,
  };
}

/**
 * Triggers a GitHub Actions workflow via workflow_dispatch.
 * Accepts workflowId as:
 * - numeric workflow id
 * - workflow filename (e.g. k1w1-triggered-build.yml)
 * - workflow name (case-insensitive)
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const auth = requireAdminKey(req);
  if (auth) return auth;

  const rl = rateLimit(req, "github-workflow-dispatch");
  if (rl) return rl;

  const token = Deno.env.get("GITHUB_TOKEN") || "";
  if (!token)
    return json(500, {
      ok: false,
      error: "Missing server secret: GITHUB_TOKEN",
    });

  const bodyRes = await readJsonBody(req);
  if (!bodyRes.ok)
    return json(400, {
      ok: false,
      error: "Validation failed",
      details: { error: bodyRes.error, received: bodyRes.received },
    });

  const body = bodyRes.body;

  const githubRepo = normalizeRepo(body);
  const workflowId = normalizeWorkflowId(body);
  const ref = normalizeRef(body);
  const inputs = getInputs(body);

  if (!githubRepo || !workflowId) {
    return json(400, {
      ok: false,
      error: "Validation failed",
      details: {
        error: !githubRepo
          ? "githubRepo must be a string"
          : "workflowId is required",
        keys: Object.keys(body),
        githubRepoType: typeof (body as any)["githubRepo"],
        workflowIdType: typeof (body as any)["workflowId"],
      },
    });
  }

  const [owner, repo] = githubRepo.split("/");
  if (!owner || !repo)
    return json(400, {
      ok: false,
      error: "Validation failed",
      details: { error: "githubRepo must be in 'owner/repo' format" },
    });

  // Resolve workflow id when workflowId is filename / name.
  const resolved = await resolveWorkflow(token, owner, repo, workflowId);
  if (!resolved.ok) {
    return json(502, {
      ok: false,
      error: "GitHub workflow resolve failed",
      details: {
        status: resolved.status,
        body: resolved.body,
        hint: resolved.hint,
      },
    });
  }

  const dispatchUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${resolved.workflow_id}/dispatches`;
  const dispatch = await fetch(dispatchUrl, {
    method: "POST",
    headers: githubHeaders(token),
    body: JSON.stringify({ ref, inputs }),
  });

  if (!dispatch.ok) {
    const text = await dispatch.text();
    return json(502, {
      ok: false,
      error: "GitHub workflow dispatch failed",
      details: {
        status: dispatch.status,
        body: text,
        resolvedWorkflow: {
          id: resolved.workflow_id,
          name: resolved.name,
          path: resolved.path,
        },
      },
    });
  }

  return json(200, {
    ok: true,
    githubRepo,
    ref,
    inputs,
    resolvedWorkflow: {
      id: resolved.workflow_id,
      name: resolved.name,
      path: resolved.path,
    },
  });
});
