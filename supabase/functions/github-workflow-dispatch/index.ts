import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import {
  getRuntimeEnv,
  getRequestRateLimitSubject,
  requireDurableRateLimit,
  requireWorkflowOperatorJwtRole,
  requireScopedEdgeAuth,
  rateLimit,
} from "../_shared/auth.ts";
import { githubHeaders, getGithubToken, GITHUB_API_BASE, isAllowedGithubRepo } from "../_shared/github.ts";
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

function isAllowedRef(ref: string): boolean {
  const r = (ref ?? "").trim();
  if (!r) return true;
  if (r.startsWith("refs/")) return false;
  if (/^[0-9a-f]{40}$/i.test(r)) return false;

  const regexStr = (getRuntimeEnv("K1W1_ALLOWED_REF_REGEX") ?? "").trim();
  if (!regexStr) return false;
  try {
    const re = new RegExp(regexStr);
    return re.test(r);
  } catch {
    return false;
  }
}

/**
 * Dispatches a GitHub Actions workflow via workflow_dispatch.
 *
 * Expected input:
 * {
 *   githubRepo: "owner/repo",
 *   workflow: "file.yml" (or workflow_id),
 *   ref: "branch",
 *   inputs?: object
 * }
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // Legacy guard lineage: generic admin-or-CI bearer guard (removed).
    const auth = requireScopedEdgeAuth(req, {
      scope: "github-workflow-dispatch",
      allowAdmin: true,
      allowJwtAuthHeaderWithAdmin: true,
      adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY",
    });
    if (auth) return auth;
    const jwtRoleGuard = await requireWorkflowOperatorJwtRole(req, "github-workflow-dispatch");
    if (jwtRoleGuard) return jwtRoleGuard;

    const durableRl = await requireDurableRateLimit(req, {
      scope: "github-workflow-dispatch",
      subject: getRequestRateLimitSubject(req),
      max: 20,
      windowMs: 60_000,
    });
    if (durableRl) return durableRl;

    const rl = rateLimit(req, "github-workflow-dispatch");
    if (rl) return rl;

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

    if (!isAllowedGithubRepo(githubRepo)) {
      return jsonResponse(
        { ok: false, error: "githubRepo not allowed", details: { githubRepo } },
        req,
        403,
      );
    }

    if (!isAllowedRef(ref)) {
      return jsonResponse({ ok: false, error: "ref not allowed", details: { ref } }, req, 403);
    }

    const [owner, repo] = githubRepo.split("/");

    const body = { ref, inputs: inputs ?? {} };

    // `workflow` can be id, filename, or a short alias.
    const raw = (workflow ?? "").trim();
    const aliasMap: Record<string, string> = {
      "ci": "k1w1-ci-lite.yml",
      "ci-lite": "k1w1-ci-lite.yml",
      "cilite": "k1w1-ci-lite.yml",
      "diagnose": "k1w1-diagnostics.yml",
      "diagnostics": "k1w1-diagnostics.yml",
    };
    const normalized = aliasMap[raw] ?? raw;

    const dispatchByIdOrName = async (wf: string | number): Promise<Response> => {
      const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/workflows/${wf}/dispatches`;
      return await ghFetch(url, token, {
        method: "POST",
        body: JSON.stringify(body),
      });
    };

    // 1) If numeric -> dispatch directly.
    if (/^[0-9]+$/.test(normalized)) {
      const r = await dispatchByIdOrName(normalized);
      if (r.ok) return jsonResponse({ ok: true, workflow: normalized }, req, 200);
      const txt = await r.text();
      const details = sanitizeGitHubFailure(r, txt);
      return errorResponse(
        "GitHub workflow dispatch failed",
        req,
        Math.max(400, Math.min(599, r.status || 502)),
        details,
      );
    }

    // 2) Build candidate filenames.
    const candidates: string[] = [];
    if (normalized) candidates.push(normalized);
    if (normalized && !normalized.includes(".")) {
      candidates.push(`${normalized}.yml`);
      candidates.push(`${normalized}.yaml`);
    }

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
