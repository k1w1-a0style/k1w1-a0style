import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import {
  getRequestRateLimitSubject,
  requireDurableRateLimit,
  requireWorkflowOperatorJwtRoleWithVerifiedActor,
  requireOwnerOrJwtAuth,
  rateLimit,
} from "../_shared/auth.ts";
import {
  githubHeaders,
  getGithubToken,
  GITHUB_API_BASE,
  isAllowedGitRef,
} from "../_shared/github.ts";
import { fetchWithTimeout } from "../_shared/fetchWithTimeout.ts";
import { sanitizeErrorText, sanitizeGitHubFailure } from "../_shared/errorSanitization.ts";
import {
  isParsedJsonBodyError,
  parseJsonBody,
  validateGithubWorkflowDispatchRequest,
} from "../_shared/validation.ts";

async function ghFetch(url: string, token: string, init: RequestInit): Promise<Response> {
  return await fetchWithTimeout(url, {
    ...init,
    timeoutMs: 15_000,
    timeoutMessage: `GitHub workflow dispatch request timed out after 15000ms: ${url}`,
    headers: {
      ...githubHeaders(token),
      ...(init.headers ?? {}),
    },
  });
}

async function findWorkflowIdByPath(
  owner: string,
  repo: string,
  token: string,
  workflowFile: string,
): Promise<number | null> {
  if (!ALLOWED_WORKFLOW_FILES.has(workflowFile)) return null;
  // Paginate defensively (rarely > 100 workflows).
  let page = 1;
  while (page <= 5) {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/workflows?per_page=100&page=${page}`;
    const r = await ghFetch(url, token, { method: "GET" });
    if (!r.ok) return null;
    const j = await r.json();
    const items = (j?.workflows ?? []) as Array<{ id: number; path: string; name?: string }>;
    const hit = items.find((w) => (w.path ?? "").endsWith(`/` + workflowFile));
    if (hit?.id) return hit.id;
    if (items.length < 100) break;
    page += 1;
  }
  return null;
}

const ALLOWED_WORKFLOW_ALIASES: Record<string, string> = {
  "ci": "k1w1-ci-lite.yml",
  "ci-lite": "k1w1-ci-lite.yml",
  "cilite": "k1w1-ci-lite.yml",
  "diagnose": "k1w1-diagnostics.yml",
  "diagnostics": "k1w1-diagnostics.yml",
};

const ALLOWED_WORKFLOW_FILES = new Set<string>([
  "k1w1-ci-lite.yml",
  "k1w1-ci-lite-autofix.yml",
  "k1w1-diagnostics.yml",
]);


/**
 * Dispatches a GitHub Actions workflow via workflow_dispatch.
 *
 * Expected input:
 * {
 *   githubRepo: "owner/repo",
 *   workflow: allowlisted file.yml or alias,
 *   ref: "branch",
 *   inputs?: object
 * }
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // Legacy guard lineage: generic admin-or-CI bearer guard (removed).
    const auth = await requireOwnerOrJwtAuth(req, {
      scope: "github-workflow-dispatch",
      adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY",
      requireJwtRoleWithVerifiedActor: requireWorkflowOperatorJwtRoleWithVerifiedActor,
    });
    if (auth.guard) return auth.guard;

    const parsed = await parseJsonBody(req, 200_000);
    if (isParsedJsonBodyError(parsed)) return errorResponse(parsed.error, req, 400);

    const val = validateGithubWorkflowDispatchRequest(parsed.body);
    if (!val.ok) return errorResponse("Invalid request", req, 400, (val as { ok: false; errors: unknown }).errors);

    const { githubRepo, workflow, ref, inputs } = val.data!;
    const token = getGithubToken().trim();

    if (!token) {
      return errorResponse("Missing GitHub token", req, 500, {
        expected: ["GITHUB_TOKEN", "GH_TOKEN", "GITHUB_API_TOKEN"],
      });
    }

    if (!isAllowedGitRef(ref)) {
      return jsonResponse({ ok: false, error: "ref not allowed", details: { ref } }, req, 403);
    }

    const actorSubject = auth.actor;
    const rateLimitSubject = getRequestRateLimitSubject(req, actorSubject);

    const durableRl = await requireDurableRateLimit(req, {
      scope: "github-workflow-dispatch",
      subject: rateLimitSubject,
      max: 20,
      windowMs: 60_000,
    });
    if (durableRl) return durableRl;

    const rl = rateLimit(req, "github-workflow-dispatch", 10, 10_000, rateLimitSubject);
    if (rl) return rl;

    const [owner, repo] = githubRepo.split("/");

    const body = { ref, inputs: inputs ?? {} };

    // `workflow` can be an allowlisted filename or a short alias.
    const raw = (workflow ?? "").trim();
    const normalized = ALLOWED_WORKFLOW_ALIASES[raw] ?? raw;

    const dispatchByIdOrName = async (wf: string | number): Promise<Response> => {
      const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/workflows/${wf}/dispatches`;
      return await ghFetch(url, token, {
        method: "POST",
        body: JSON.stringify(body),
      });
    };

    // 1) Numeric workflow IDs are not accepted; dispatch stays file/alias allowlist-only.
    if (/^[0-9]+$/.test(normalized)) {
      return errorResponse(
        "GitHub workflow dispatch failed (disallowed_workflow_identifier)",
        req,
        400,
        {
          code: "disallowed_workflow_identifier",
          hint: "Numeric workflow IDs are not accepted; use an allowlisted workflow alias/file.",
        },
      );
    }

    // 2) Build fail-closed candidate filenames.
    if (!ALLOWED_WORKFLOW_FILES.has(normalized)) {
      return errorResponse(
        "GitHub workflow dispatch failed (missing_workflow)",
        req,
        404,
        {
          code: "missing_workflow",
          hint: "Workflow alias/file is not allowlisted for dispatch.",
        },
      );
    }
    const candidates = [normalized];

    // 3) First try: resolve workflow id by path and dispatch.
    for (const wfFile of candidates) {
      const id = await findWorkflowIdByPath(owner, repo, token, wfFile);
      if (id) {
        const r = await dispatchByIdOrName(id);
        if (r.ok) return jsonResponse({ ok: true, workflow: wfFile, workflow_id: id }, req, 200);
      }
    }

    // 4) Fallback: direct dispatch by filename (GitHub supports this, but can 404 when missing).
    let lastResp: Response | null = null;
    for (const wfFile of candidates) {
      const r = await dispatchByIdOrName(wfFile);
      if (r.ok) return jsonResponse({ ok: true, workflow: wfFile }, req, 200);
      lastResp = r;
      if (r.status !== 404) break;
    }

    // 5) Dispatch path is fail-closed: no implicit repo mutations/bootstrap here.
    // If still not ok, bubble the last response.
    const r = lastResp ?? (await dispatchByIdOrName(candidates[0] ?? normalized));
    if (!r.ok) {
      const txt = await r.text();
      const details = sanitizeGitHubFailure(r, txt);
      const status = Math.max(400, Math.min(599, r.status || 502));

      if (status === 404) {
        return errorResponse(
          "GitHub workflow dispatch failed (missing_workflow)",
          req,
          404,
          {
            ...details,
            code: "missing_workflow",
            hint:
              "Workflow not found in repo. Dispatch is mutation-free; run explicit bootstrap/repair (RepoScreen Workflows/Core Files push or CI autofix/provisioning) and retry dispatch.",
          },
        );
      }

      return errorResponse("GitHub workflow dispatch failed", req, status, details);
    }

    return jsonResponse({ ok: true }, req, 200);
  } catch (e) {
    return errorResponse("Unexpected error", req, 500, {
      message: sanitizeErrorText(e?.message ?? String(e)),
    });
  }
});
