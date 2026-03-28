import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import {
  isScopedCiBearerRequest,
  requireDurableRateLimit,
  requireWorkflowOperatorJwtRole,
  requireScopedEdgeAuth,
  rateLimit,
} from "../_shared/auth.ts";
import { githubHeaders, getGithubToken, GITHUB_API_BASE } from "../_shared/github.ts";
import { fetchWithTimeout } from "../_shared/fetchWithTimeout.ts";
import { sanitizeErrorText, sanitizeGitHubFailure } from "../_shared/errorSanitization.ts";
import {
  parseJsonBody,
  validateGithubWorkflowDispatchRequest,
} from "../_shared/validation.ts";

// Shared SoT workflow templates for bootstrapping when a repo is missing managed workflows.
import { WORKFLOW_TEMPLATES } from "../../../shared/workflows/managedWorkflowTemplates.ts";

function b64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

function unb64Utf8(s: string): string {
  return decodeURIComponent(escape(atob(s)));
}

function parseManagedWorkflowMeta(content: string): { managedBy: string | null; workflowVersion: string | null } {
  const managedBy =
    content.match(/^# managed-by:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const workflowVersion =
    content.match(/^# workflow-version:\s*(.+)$/m)?.[1]?.trim() ?? null;
  return { managedBy, workflowVersion };
}

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

async function ensureWorkflowFileExists(
  owner: string,
  repo: string,
  token: string,
  ref: string,
  workflowFile: string,
): Promise<{ ok: boolean; created?: boolean; updated?: boolean; details?: unknown }> {
  const template = WORKFLOW_TEMPLATES[workflowFile];
  if (!template) return { ok: false, details: { reason: "no_template", workflowFile } };
  const v = validateWorkflowTemplate(workflowFile, template);
  if (!v.ok) {
    const reason = (v as { ok: false; reason: string }).reason;
    return { ok: false, details: { reason: "template_invalid", workflowFile, why: reason } };
  }


  const path = `.github/workflows/${workflowFile}`;
  const getUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`;
  const getResp = await ghFetch(getUrl, token, { method: "GET" });
  let sha: string | undefined;
  let currentMeta: { managedBy: string | null; workflowVersion: string | null } | null = null;
  if (getResp.ok) {
    const j = await getResp.json();
    sha = j?.sha;
    const encoded = typeof j?.content === "string" ? j.content.replace(/\n/g, "") : "";
    if (encoded) {
      try {
        currentMeta = parseManagedWorkflowMeta(unb64Utf8(encoded));
      } catch {
        currentMeta = { managedBy: null, workflowVersion: null };
      }
    }
  }

  const putUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const payload: Record<string, unknown> = {
    message: sha
      ? `k1w1: update managed workflow ${workflowFile}`
      : `k1w1: add managed workflow ${workflowFile}`,
    content: b64(template + "\n"),
    branch: ref,
  };
  if (sha) payload.sha = sha;

  const putResp = await ghFetch(putUrl, token, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  if (!putResp.ok) {
    const txt = await putResp.text();
    return { ok: false, details: sanitizeGitHubFailure(putResp, txt) };
  }
  return {
    ok: true,
    created: !sha,
    updated: !!sha,
    details: {
      currentMeta,
      managedBy: "k1w1",
      workflowVersion: "399",
    },
  };
}

function parseCsvEnv(name: string): string[] {
  const raw = (Deno.env.get(name) ?? "").trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function isAllowedRepo(repo: string): boolean {
  const allow = parseCsvEnv("K1W1_ALLOWED_GITHUB_REPOS");
  if (allow.length === 0) return true; // rollout mode
  return allow.includes(repo);
}

function isAllowedRef(ref: string): boolean {
  const r = (ref ?? "").trim();
  if (!r) return true;
  if (r.startsWith("refs/")) return false;
  if (/^[0-9a-f]{40}$/i.test(r)) return false;

  const regexStr = (Deno.env.get("K1W1_ALLOWED_REF_REGEX") ?? "").trim();
  if (!regexStr) return true; // rollout mode
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
    // Legacy guard lineage: requireAdminKeyOrServiceRoleBearer(req).
    const auth = requireScopedEdgeAuth(req, {
      scope: "github-workflow-dispatch",
      allowAdmin: true,
      allowCiBearer: true,
      allowJwtAuthHeaderWithAdmin: true,
      adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY",
      ciBearerSecretEnv: "K1W1_EDGE_WORKFLOW_CI_BEARER",
    });
    if (auth) return auth;
    const usedCiBearer = isScopedCiBearerRequest(req, "K1W1_EDGE_WORKFLOW_CI_BEARER");
    if (!usedCiBearer) {
      const jwtRoleGuard = await requireWorkflowOperatorJwtRole(req, "github-workflow-dispatch");
      if (jwtRoleGuard) return jwtRoleGuard;
    }

    const durableRl = await requireDurableRateLimit(req, {
      scope: "github-workflow-dispatch",
      subject: req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown",
      max: 20,
      windowMs: 60_000,
    });
    if (durableRl) return durableRl;

    const rl = rateLimit(req, "github-workflow-dispatch");
    if (rl) return rl;

    const parsed = await parseJsonBody(req, 200_000);
    if (!parsed.ok) return errorResponse((parsed as { ok: false; error: string }).error, req, 400);

    const val = validateGithubWorkflowDispatchRequest(parsed.body);
    if (!val.ok) return errorResponse("Invalid request", req, 400, (val as { ok: false; errors: unknown }).errors);

    const { githubRepo, workflow, ref, inputs } = val.data!;
    const token = getGithubToken().trim();

    if (!token) {
      return errorResponse("Missing GitHub token", req, 500, {
        expected: ["GITHUB_TOKEN", "GH_TOKEN", "GITHUB_API_TOKEN"],
      });
    }

    if (!isAllowedRepo(githubRepo)) {
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
    let lastDetails: Record<string, unknown> | null = null;
    for (const wfFile of candidates) {
      const r = await dispatchByIdOrName(wfFile);
      if (r.ok) return jsonResponse({ ok: true, workflow: wfFile }, req, 200);
      lastResp = r;
      const txt = await r.text();
      lastDetails = sanitizeGitHubFailure(r, txt) as Record<string, unknown>;
      if (r.status !== 404) break;
    }

    // 5) Auto-fix 404 / stale workflow inputs: bootstrap known workflows, then retry.
    const last = lastResp;
    const unexpectedInputs =
      !!last && !!lastDetails && last.status === 422 && /Unexpected inputs provided/i.test(String(lastDetails.message || ""));

    if (last && (last.status === 404 || unexpectedInputs)) {
      // Choose the first file candidate that we can bootstrap.
      const bootTarget = candidates.find((c) => !!WORKFLOW_TEMPLATES[c]) ?? null;
      if (bootTarget) {
        const ensured = await ensureWorkflowFileExists(owner, repo, token, ref, bootTarget);
        if (ensured.ok) {
          // GitHub needs a moment to register new/updated workflows.
          for (const wait of [750, 1500, 2500, 4000]) {
            await sleep(wait);
            const id = await findWorkflowIdByPath(owner, repo, token, bootTarget);
            if (id) {
              const r = await dispatchByIdOrName(id);
              if (r.ok) {
                return jsonResponse(
                  { ok: true, workflow: bootTarget, workflow_id: id, bootstrapped: ensured },
                  req,
                  200,
                );
              }
              lastResp = r;
            }
          }
        } else {
          return errorResponse(
            "GitHub workflow dispatch failed (workflow missing; bootstrap failed)",
            req,
            404,
            {
              ...(typeof ensured.details === "object" && ensured.details ? ensured.details as Record<string, unknown> : {}),
              hint:
                "Workflow not found and auto-bootstrap failed. Check token permissions (contents:write) and branch protection.",
            },
          );
        }
      }
    }

    // If still not ok, bubble the last response.
    const r = lastResp ?? (await dispatchByIdOrName(candidates[0] ?? normalized));
    if (!r.ok) {
      const txt = await r.text();
      const details = sanitizeGitHubFailure(r, txt);
      const status = Math.max(400, Math.min(599, r.status || 502));

      if (status === 404) {
        return errorResponse(
          "GitHub workflow dispatch failed (workflow not found)",
          req,
          404,
          {
            ...details,
            hint:
              "Workflow not found in repo. Ensure the workflow file exists under .github/workflows and matches the name you dispatch (e.g. k1w1-ci-lite.yml).",
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
