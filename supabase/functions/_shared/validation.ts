import { isSafePath, normalizePath, safeJsonForScript, escapeHtml } from "./security.ts";

type Ok<T> = { ok: true; data: T };
type ValidationErrors = Record<string, string | Record<string, string>>;
type Err = { ok: false; errors: ValidationErrors };

export async function parseJsonBody(
  req: Request,
  maxBytes = 200_000,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; error: string }> {
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
      const body: unknown = JSON.parse(t);
      if (!isObject(body)) {
        return { ok: false, error: "Invalid JSON: body must be a JSON object" };
      }
      return { ok: true, body };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: `Invalid JSON: ${msg}` };
    }
  });
}

function isString(x: unknown): x is string {
  return typeof x === "string";
}

function isObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function isBuildProfile(
  value: unknown,
): value is "development" | "preview" | "production" {
  return value === "development" || value === "preview" || value === "production";
}

function asStringRecord(value: unknown): Record<string, string> | null {
  if (!isObject(value)) return null;
  const mapped: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (!isString(k) || k.length > 100) return null;
    if (!isString(v) || v.length > 2000) return null;
    mapped[k] = v;
  }
  return mapped;
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

function getBranchValidationError(
  result: ReturnType<typeof validateBranch>,
): string | null {
  return "error" in result ? result.error : null;
}

export function validateTriggerBuildRequest(body: unknown): Ok<{
  githubRepo: string;
  buildProfile: "development" | "preview" | "production";
  branch: string;
}> | Err {
  if (!isObject(body)) return { ok: false, errors: { error: "body must be an object" } };

  const githubRepo = body.githubRepo ?? body.github_repo ?? body.repo ?? body.repository;
  const buildProfile = body.buildProfile ?? body.build_profile ?? body.profile;
  const branch = body.branch ?? body.ref;

  const errors: ValidationErrors = {};

  if (!isString(githubRepo) || !githubRepo.includes("/")) {
    errors.githubRepo = "githubRepo must be like owner/repo";
  }

  if (!isBuildProfile(buildProfile)) {
    errors.buildProfile = "buildProfile must be development|preview|production";
  }

  if (!isString(branch) || !branch.trim()) {
    errors.branch = "branch must be a non-empty branch name";
  }

  const br = validateBranch(branch);
  const branchError = getBranchValidationError(br);
  if (branchError) errors.branch = branchError;

  if (Object.keys(errors).length) return { ok: false, errors };
  if (!br.valid || !isBuildProfile(buildProfile) || !isString(githubRepo)) return { ok: false, errors };

  return {
    ok: true,
    data: {
      githubRepo,
      buildProfile,
      branch: br.value,
    },
  };
}

export function validateCheckBuildRequest(body: unknown): Ok<{ jobId: string }> | Err {
  if (!isObject(body)) return { ok: false, errors: { error: "body must be an object" } };
  const rawJobId = body.jobId ?? body.job_id ?? body.id;

  let normalized: string | null = null;
  if (typeof rawJobId === "number") {
    normalized = Number.isInteger(rawJobId) && rawJobId > 0 ? String(rawJobId) : null;
  } else if (isString(rawJobId)) {
    const trimmed = rawJobId.trim();
    normalized = /^[1-9]\d*$/.test(trimmed) ? trimmed : null;
  }

  if (!normalized) {
    return { ok: false, errors: { jobId: "jobId must be a positive integer id" } };
  }

  return { ok: true, data: { jobId: normalized } };
}

export function validateGithubWorkflowDispatchRequest(body: unknown): Ok<{
  githubRepo: string;
  workflow: string;
  ref: string;
  inputs?: Record<string, string>;
}> | Err {
  if (!isObject(body)) return { ok: false, errors: { error: "body must be an object" } };

  const githubRepo = body.githubRepo ?? body.github_repo ?? body.repo ?? body.repository;
  const workflow = body.workflow ?? body.workflowId ?? body.workflow_id ?? body.path;
  const ref = body.ref ?? body.branch;
  const inputs = body.inputs;

  const errors: ValidationErrors = {};

  if (!isString(githubRepo) || !githubRepo.includes("/")) {
    errors.githubRepo = "githubRepo must be like owner/repo";
  }

  if (!isString(workflow) || workflow.length < 1 || workflow.length > 200) {
    errors.workflow = "workflow must be a string (filename or id)";
  }

  if (!isString(ref) || !ref.trim()) {
    errors.ref = "ref must be a non-empty branch name";
  }

  const br = validateBranch(ref);
  const refError = getBranchValidationError(br);
  if (refError) errors.ref = refError;

  let normalizedInputs: Record<string, string> | undefined;
  if (inputs != null) {
    const mapped = asStringRecord(inputs);
    if (!mapped) {
      errors.inputs = "inputs must be an object";
      if (isObject(inputs)) {
        const bad: Record<string, string> = {};
        for (const [k, v] of Object.entries(inputs)) {
          if (!isString(k) || k.length > 100) bad[k] = "invalid key";
          if (!isString(v) || v.length > 2000) bad[k] = "invalid value";
        }
        if (Object.keys(bad).length) errors.inputs = bad;
      }
    } else {
      normalizedInputs = mapped;
    }
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  if (!isString(githubRepo) || !isString(workflow) || !br.valid) return { ok: false, errors };

  return {
    ok: true,
    data: {
      githubRepo,
      workflow,
      ref: br.value,
      inputs: normalizedInputs,
    },
  };
}

// Re-export security helpers that other modules already use
export { isSafePath, normalizePath, safeJsonForScript, escapeHtml };
