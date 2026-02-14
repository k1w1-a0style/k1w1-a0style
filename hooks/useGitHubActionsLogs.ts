// hooks/useGitHubActionsLogs.ts - Real-time GitHub Actions log streaming
import { useEffect, useState, useCallback, useRef } from "react";
import { CONFIG } from "../config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../lib/storageKeys";
import { getEdgeAdminKey } from "../contexts/githubService";
import { redactSecrets, truncateWithMarker } from "../lib/secretRedaction";

export interface LogEntry {
  timestamp: string;
  message: string;
  level: "info" | "warning" | "error" | "raw";
  step?: string;
}

export interface WorkflowRun {
  id: number;
  status: "queued" | "in_progress" | "completed";
  conclusion?: "success" | "failure" | "cancelled" | "skipped";
  html_url: string;
  run_number: number;
  created_at: string;
  updated_at: string;
}

interface UseGitHubActionsLogsOptions {
  githubRepo: string | null;
  runId?: number | null;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseGitHubActionsLogsResult {
  logs: LogEntry[];
  workflowRun: WorkflowRun | null;
  isLoading: boolean;
  error: string | null;
  refreshLogs: () => Promise<void>;
}

const POLL_INTERVAL_MS = 5000; // 5 seconds
const MAX_LOG_ENTRIES = 500;

// Keep UI + clipboard safe: cap per-line length and redact secrets before exposing logs.
const MAX_LOG_LINE_LEN = 4_000;
const TRUNC_MARK = "…<truncated>";

function sanitizeLogLine(line: string): string {
  const redacted = redactSecrets(line || "");
  return truncateWithMarker(redacted, MAX_LOG_LINE_LEN, TRUNC_MARK);
}
async function describeEdgeFailure(opts: {
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

  let bodyJson: any = null;
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


async function getSupabaseEdgeUrl(): Promise<string> {
  // ✅ Prefer runtime-configured Supabase URL (ConnectionsScreen)
  const storedUrl = await AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL).catch(
    () => null,
  );
  const runtimeUrl =
    storedUrl ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((typeof process !== "undefined"
      ? (process as any).env?.EXPO_PUBLIC_SUPABASE_URL
      : null) as string | null) ||
    null;

  if (runtimeUrl) {
    return `${runtimeUrl.replace(/\/$/, "")}/functions/v1`;
  }

  // Fallback: static config
  return CONFIG.API.SUPABASE_EDGE_URL;
}

/**
 * Hook to stream GitHub Actions logs in real-time
 * Polls GitHub API for latest workflow run and job logs
 */
export function useGitHubActionsLogs({
  githubRepo,
  runId,
  autoRefresh = true,
  refreshInterval = POLL_INTERVAL_MS,
}: UseGitHubActionsLogsOptions): UseGitHubActionsLogsResult {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [workflowRun, setWorkflowRun] = useState<WorkflowRun | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  const loggedErrorRef = useRef(false);
  const isFetchPendingRef = useRef(false);

  const fetchLogs = useCallback(async () => {
    if (!githubRepo) {
      setError("Kein GitHub Repo ausgewählt");
      return;
    }
    if (isFetchPendingRef.current) return;
    isFetchPendingRef.current = true;

    setIsLoading(true);
    setError(null);
    loggedErrorRef.current = false;

    try {
      // Fetch latest workflow run if no runId provided
      let targetRunId = runId;
      const edgeUrl = await getSupabaseEdgeUrl();
      const edgeAdminKey = await getEdgeAdminKey().catch(() => null);

      if (!targetRunId) {
        const runsResponse = await fetch(`${edgeUrl}/github-workflow-runs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(edgeAdminKey ? { "x-k1w1-admin-key": edgeAdminKey } : {}),
          },
          body: JSON.stringify({ githubRepo, workflowId: "k1w1-triggered-build.yml" }),
        });

        if (!runsResponse.ok) {
          throw new Error(
            await describeEdgeFailure({
              fnName: "github-workflow-runs",
              res: runsResponse,
              edgeUrl,
              hasAdminKey: !!edgeAdminKey,
            }),
          );
        }

        const runsData = await runsResponse.json();

        const runs =
          runsData?.data?.workflow_runs ??
          runsData?.workflow_runs ??
          runsData?.runs ??
          [];

        if (Array.isArray(runs) && runs.length > 0) {
          targetRunId = runs[0].id;
          setWorkflowRun(runs[0]);
        } else {
          setLogs([]);
          setIsLoading(false);
          return;
        }
      }

      // Fetch logs for the workflow run
      const logsResponse = await fetch(`${edgeUrl}/github-workflow-logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(edgeAdminKey ? { "x-k1w1-admin-key": edgeAdminKey } : {}),
        },
        body: JSON.stringify({
          githubRepo,
          runId: targetRunId,
          mode: "raw",
        }),
      });

      if (!logsResponse.ok) {
        throw new Error(
          await describeEdgeFailure({
            fnName: "github-workflow-logs",
            res: logsResponse,
            edgeUrl,
            hasAdminKey: !!edgeAdminKey,
          }),
        );
      }

      const logsData = await logsResponse.json();

      if (isMountedRef.current) {
        // If GitHub hasn't prepared the logs archive yet, treat it as a "soft" state (no red error).
        if (logsData?.ok === true && logsData?.status === "not_ready") {
          setError(null);
          const now = new Date().toISOString();
          const runStatus = String(logsData?.runStatus ?? "unknown");
          const runConclusion =
            logsData?.runConclusion != null ? String(logsData.runConclusion) : null;
          const hint = runConclusion
            ? `Logs noch nicht verfügbar (${runStatus}/${runConclusion}).`
            : `Logs noch nicht verfügbar (${runStatus}).`;

          setLogs([{ timestamp: now, message: hint, level: "info" }]);
          setIsLoading(false);
          return;
        }

        // logs function returns logsText (string). Convert to LogEntry[].
        const text: string =
          typeof logsData?.logsText === "string" ? logsData.logsText : "";
         const lines = text.split(/\r?\n/);

         const rawLogs: LogEntry[] = lines
           .filter((l) => l != null && l !== "")
           .map((message) => ({
             timestamp: "",
             // IMPORTANT: never expose raw CI logs to UI/clipboard without redaction.
             message: sanitizeLogLine(message),
             level: "raw" as const,
           }));

         const limitedLogs = rawLogs.slice(-MAX_LOG_ENTRIES);
         setLogs(limitedLogs);

         // keep existing workflowRun unless the response includes one
         if (logsData?.workflowRun) {
           setWorkflowRun(logsData.workflowRun);
         }
       }
    } catch (err: any) {
      // Nur einmal loggen (nicht bei jedem Poll-Versuch)
      if (isMountedRef.current && !loggedErrorRef.current) {
        console.warn(
          "[useGitHubActionsLogs] ⚠️ Logs nicht verfügbar:",
          err?.message,
        );
        loggedErrorRef.current = true;
      }
      if (isMountedRef.current) {
        setError(err?.message || "Fehler beim Abrufen der Logs");
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      isFetchPendingRef.current = false;
    }
  }, [githubRepo, runId]);

  const refreshLogs = useCallback(async () => {
    await fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh effect - uses workflowRun ref to avoid stale closure issues
  const workflowStatusRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    workflowStatusRef.current = workflowRun?.status;
  }, [workflowRun?.status]);

  useEffect(() => {
    if (!githubRepo || !autoRefresh) {
      return;
    }

    // Initial fetch
    fetchLogs();

    // Set up interval - check ref inside interval callback
    const checkAndFetch = () => {
      const currentStatus = workflowStatusRef.current;
      if (
        currentStatus === "in_progress" ||
        currentStatus === "queued" ||
        !currentStatus
      ) {
        fetchLogs();
      } else {
        // Stop polling when completed
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    intervalRef.current = setInterval(checkAndFetch, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [githubRepo, autoRefresh, refreshInterval, fetchLogs]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    logs,
    workflowRun,
    isLoading,
    error,
    refreshLogs,
  };
}
