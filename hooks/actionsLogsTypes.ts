// hooks/actionsLogsTypes.ts
// Extracted from useGitHubActionsLogs.ts: types, constants, helpers.

// hooks/useGitHubActionsLogs.ts - Real-time GitHub Actions log streaming
import { redactSecrets, truncateWithMarker } from "../lib/secretRedaction";
import type { WorkflowRun } from "../shared/types/workflowRun";

export type { WorkflowRun } from "../shared/types/workflowRun";

export interface LogEntry {
  timestamp: string;
  message: string;
  level: "info" | "warning" | "error" | "raw";
  step?: string;
}


export interface UseGitHubActionsLogsOptions {
  githubRepo: string | null;
  runId?: number | null;
  /** Workflow file name (e.g. "k1w1-triggered-build.yml"). Used when runId is omitted. */
  workflowId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseGitHubActionsLogsResult {
  logs: LogEntry[];
  workflowRun: WorkflowRun | null;
  isLoading: boolean;
  error: string | null;
  refreshLogs: () => Promise<void>;
}

export const POLL_INTERVAL_MS = 5000; // 5 seconds
export const MAX_LOG_ENTRIES = 500;

// Keep UI + clipboard safe: cap per-line length and redact secrets before exposing logs.
export const MAX_LOG_LINE_LEN = 4_000;
export const TRUNC_MARK = "…<truncated>";

export function sanitizeLogLine(line: string): string {
  const redacted = redactSecrets(line || "");
  return truncateWithMarker(redacted, MAX_LOG_LINE_LEN, TRUNC_MARK);
}
export async function describeEdgeFailure(opts: {
  fnName: string;
  res: Response;
  edgeUrl: string;
  hasAdminKey: boolean;
}): Promise<string> {
  const { fnName, res, edgeUrl, hasAdminKey } = opts;
  const status = res.status;
  let bodyText = "";
  try {
    bodyText = await res.text();
  } catch {
    bodyText = "";
  }

  type EdgeFailurePayload = {
    error?: unknown;
    message?: unknown;
    missing?: unknown;
    required?: unknown;
    details?: {
      error?: unknown;
      message?: unknown;
      missing?: unknown;
      required?: unknown;
      status?: unknown;
    } | null;
  };

  let bodyJson: EdgeFailurePayload | null = null;
  try {
    bodyJson = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    bodyJson = null;
  }

  const err =
    String(
      bodyJson?.error ??
        bodyJson?.message ??
        bodyJson?.details?.error ??
        bodyJson?.details?.message ??
        "",
    ).trim();

  const missing = bodyJson?.missing ?? bodyJson?.details?.missing;
  const required = bodyJson?.required ?? bodyJson?.details?.required;
  const ghDetails = bodyJson?.details ?? null;

  const safeBody = truncateWithMarker(
    redactSecrets(bodyText || ""),
    2_000,
    "…<truncated>",
  );

  let hint = "";
  if (status === 404) {
    hint = `Edge Function '${fnName}' nicht deployed (edgeUrl: ${edgeUrl}).`;
  } else if (status === 401) {
    hint = hasAdminKey
      ? "Edge Admin Key wurde abgelehnt (x-k1w1-admin-key). Prüfe K1W1_EDGE_ADMIN_KEY / SIGNING_ADMIN_KEY."
      : "Edge Admin Key fehlt (x-k1w1-admin-key). Setze K1W1_EDGE_ADMIN_KEY in der App oder nutze Bearer (Service Role) in CI.";
  } else if (status === 429) {
    hint = "Rate limit aktiv – bitte kurz warten.";
  } else if (status >= 500) {
    // Common: missing secrets on the Edge Function.
    if (Array.isArray(missing) && missing.length) {
      hint = `Edge Function Secrets fehlen: ${missing.join(", ")}`;
    } else if (required) {
      hint = String(required);
    } else if (ghDetails?.status) {
      hint = `GitHub API Status: ${String(ghDetails.status)}`;
    } else {
      hint = "Edge Function Fehler – bitte Logs/Deployment prüfen.";
    }
  }

  const base = `[${fnName}] ${status}`;
  const msg = err || res.statusText || "Request failed";
  const extra = hint ? ` | ${hint}` : "";
  // include a small redacted body snippet for debugging
  const snippet =
    !err && safeBody ? ` | body: ${safeBody}` : !err ? "" : "";
  return `${base}: ${msg}${extra}${snippet}`;
}


// getSupabaseEdgeUrl moved to lib/supabaseEdge.ts (shared across UI + hooks)

/**
 * Hook to stream GitHub Actions logs in real-time
 * Polls GitHub API for latest workflow run and job logs
 */
