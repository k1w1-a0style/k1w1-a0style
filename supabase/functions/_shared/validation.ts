import {
  isSafePath,
  normalizePath,
  safeJsonForScript,
  escapeHtml,
} from "./security.ts";

/**
 * Central validation helpers for Edge Functions.
 *
 * NOTE: Keep these pure + dependency-light.
 */

type Ok<T> = { ok: true; data: T };
type Err = { ok: false; errors: any };

export function parseJsonBody(
  req: Request,
  maxBytes = 200_000,
): Promise<{ ok: true; body: any } | { ok: false; error: string }> {
  const lenHeader = req.headers.get("content-length");
  if (lenHeader) {
    const len = Number(lenHeader);
    if (Number.isFinite(len) && len > maxBytes) {
      return Promise.resolve({
        ok: false,
        error: `Body too large (content-length=${len} > ${maxBytes})`,
      });
    }
  }

  return req.text().then((t) => {
    if (!t || !t.trim()) return { ok: true, body: {} };
    if (t.length > maxBytes)
      return { ok: false, error: `Body too large (${t.length} > ${maxBytes})` };

    try {
      const body = JSON.parse(t);
      return { ok: true, body };
    } catch (e) {
      return { ok: false, error: `Invalid JSON: ${e?.message ?? String(e)}` };
    }
  });
}

function isString(x: unknown): x is string {
  return typeof x === "string";
}

function isObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

export function validateBranch(
  input: unknown,
): { valid: true; value: string } | { valid: false; error: string } {
  if (input == null) return { valid: true, value: "" };

  if (!isString(input)) return { valid: false, error: "branch must be a string" };

  const trimmed = input.trim();
  if (!trimmed) return { valid: true, value: "" };

  // Git branch allowed charset (conservative)
  const safeRefRegex = /^[A-Za-z0-9._/-]{1,200}$/;
  if (!safeRefRegex.test(trimmed)) {
    return { valid: false, error: "Invalid branch format" };
  }

  // Disallow full refs/* and full SHAs (defense-in-depth)
  if (trimmed.startsWith("refs/")) {
    return { valid: false, error: "branch must be a branch name, not refs/*" };
  }
  if (/^[0-9a-f]{40}$/i.test(trimmed)) {
    return { valid: false, error: "branch must not be a full 40-char SHA" };
  }

  return { valid: true, value: trimmed };
}

export function validateTriggerBuildRequest(body: unknown): Ok<{
  githubRepo: string;
  buildProfile: "development" | "preview" | "production";
  branch?: string;
}> | Err {
  if (!isObject(body)) return { ok: false, errors: { error: "body must be an object" } };

  const githubRepo = body.githubRepo ?? body.github_repo ?? body.repo ?? body.repository;
  const buildProfile = body.buildProfile ?? body.build_profile ?? body.profile;
  const branch = body.branch ?? body.ref;

  const errors: any = {};

  if (!isString(githubRepo) || !githubRepo.includes("/")) {
    errors.githubRepo = "githubRepo must be like owner/repo";
  }

  if (
    !isString(buildProfile) ||
    !["development", "preview", "production"].includes(buildProfile)
  ) {
    errors.buildProfile = "buildProfile must be development|preview|production";
  }

  const br = validateBranch(branch);
  if (!br.valid) errors.branch = br.error;

  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    data: {
      githubRepo: String(githubRepo),
      buildProfile: buildProfile as any,
      branch: br.value || undefined,
    },
  };
}

export function validateCheckBuildRequest(body: unknown): Ok<{ jobId: string }> | Err {
  if (!isObject(body)) return { ok: false, errors: { error: "body must be an object" } };
  const jobId = body.jobId ?? body.job_id ?? body.id;
  if (!isString(jobId)) {
    return { ok: false, errors: { jobId: "jobId must be a UUID string" } };
  }
  const uuid = String(jobId).trim();
  if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(uuid)) {
    return { ok: false, errors: { jobId: "jobId must be a UUID" } };
  }
  return { ok: true, data: { jobId: uuid } };
}

export function validateGithubWorkflowDispatchRequest(body: unknown): Ok<{
  githubRepo: string;
  workflow: string;
  ref: string;
  inputs?: Record<string, string>;
  githubToken?: string;
}> | Err {
  if (!isObject(body)) return { ok: false, errors: { error: "body must be an object" } };

  const githubRepo = body.githubRepo ?? body.github_repo ?? body.repo ?? body.repository;
  const workflow = body.workflow ?? body.workflowId ?? body.workflow_id ?? body.path;
  const ref = body.ref ?? body.branch ?? "main";
  const inputs = body.inputs;
  const githubToken = body.githubToken ?? body.github_token ?? body.token ?? null;

  const errors: any = {};

  if (!isString(githubRepo) || !githubRepo.includes("/")) {
    errors.githubRepo = "githubRepo must be like owner/repo";
  }

  if (!isString(workflow) || workflow.length < 1 || workflow.length > 200) {
    errors.workflow = "workflow must be a string (filename or id)";
  }

  if (githubToken !== null && githubToken !== undefined && !isString(githubToken)) {
    errors.githubToken = "githubToken must be a string";
  }

  const br = validateBranch(ref);
  if (!br.valid) errors.ref = br.error;

  if (inputs != null) {
    if (!isObject(inputs)) {
      errors.inputs = "inputs must be an object";
    } else {
      // Make sure all inputs are strings and not crazy large
      const bad: any = {};
      for (const [k, v] of Object.entries(inputs)) {
        if (!isString(k) || k.length > 100) bad[k] = "invalid key";
        if (!isString(v) || v.length > 2000) bad[k] = "invalid value";
      }
      if (Object.keys(bad).length) errors.inputs = bad;
    }
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    data: {
      githubRepo: String(githubRepo),
      workflow: String(workflow),
      ref: br.value || "main",
      inputs: inputs as any,
    },
  };
}

// Re-export security helpers that other modules already use
export { isSafePath, normalizePath, safeJsonForScript, escapeHtml };
