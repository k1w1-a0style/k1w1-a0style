import { TimeoutError } from "../../../lib/network/fetchWithTimeout";
import { redactSecrets, truncateWithMarker } from "../../../lib/secretRedaction";
import {
  getWorkflowRunDetails,
  getWorkflowRunJobs,
  type WorkflowJob,
  type WorkflowRunDetails,
} from "../../../infra/github/workflows";
import type { BuildStatus } from "../../../shared/types/build";
import { getStatusIcon } from "../../../utils/buildScreenUtils";

export const FETCH_TIMEOUT_MS = 15_000;
export const MAX_ALERT_MESSAGE_LEN = 600;

export type RepoValidation =
  | { valid: true; owner: string; repo: string; normalized: string }
  | { valid: false; error: string; normalized: string };

export function sanitizeUiMessage(input: string): string {
  const redacted = redactSecrets(input || "");
  return truncateWithMarker(redacted, MAX_ALERT_MESSAGE_LEN, "…");
}

export function validateRepoFullName(input: string): RepoValidation {
  const normalized = (input || "").trim();
  if (!normalized) {
    return { valid: false, error: "Repo darf nicht leer sein.", normalized };
  }
  const parts = normalized.split("/");
  if (parts.length !== 2) {
    return {
      valid: false,
      error: 'Format muss "owner/repo" sein (genau ein /).',
      normalized,
    };
  }
  const [owner, repo] = parts;
  if (!owner || !repo) {
    return {
      valid: false,
      error: "Owner und Repo dürfen nicht leer sein.",
      normalized,
    };
  }
  // GitHub naming rules (pragmatic): letters, numbers, dots, underscores, hyphens.
  const re = /^[A-Za-z0-9._-]+$/;
  if (!re.test(owner)) {
    return {
      valid: false,
      error: "Ungültige Zeichen im Owner.",
      normalized,
    };
  }
  if (!re.test(repo)) {
    return {
      valid: false,
      error: "Ungültige Zeichen im Repo-Namen.",
      normalized,
    };
  }
  return { valid: true, owner, repo, normalized };
}

export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  // Intentional higher-level deadline guard: the underlying GitHub helpers already use the
  // shared fetchWithTimeout(...) contract per request, while this caps the full async bundle
  // without widening downstream helper signatures just to thread AbortSignals through.
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new TimeoutError("Timeout", ms)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function fetchRunDetailsBundle(
  owner: string,
  repo: string,
  runId: number,
): Promise<{ details: WorkflowRunDetails; jobs: WorkflowJob[] }> {
  const [details, jobs] = await Promise.all([
    withTimeout(getWorkflowRunDetails(owner.trim(), repo.trim(), runId), FETCH_TIMEOUT_MS),
    withTimeout(getWorkflowRunJobs(owner.trim(), repo.trim(), runId), FETCH_TIMEOUT_MS),
  ]);
  return {
    details,
    jobs: Array.isArray(jobs) ? jobs : [],
  };
}

export const resolveBuildStatusPresentation = (params: {
  status: BuildStatus;
  progress?: number | null;
}): { statusEmoji: string; statusLabel: string } => {
  const { status, progress } = params;
  return {
    statusEmoji: getStatusIcon(status),
    statusLabel:
      status === "building" && typeof progress === "number"
        ? `${Math.round(progress * 100)}%`
        : status.toUpperCase(),
  };
};
