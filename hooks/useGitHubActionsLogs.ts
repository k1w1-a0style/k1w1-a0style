// hooks/useGitHubActionsLogs.ts
// REFACTORED: types/helpers → actionsLogsTypes.ts

// hooks/useGitHubActionsLogs.ts - Real-time GitHub Actions log streaming
import { useEffect, useState, useCallback, useRef } from "react";
import { getEdgeAdminKey } from "../infra/github/githubService";
import { requireSupabaseEdgeUrl } from "../lib/supabaseEdge";
import { SUPABASE_EDGE_FUNCTIONS } from "../shared/constants/supabase";
import { logger } from '../lib/logger';

import { POLL_INTERVAL_MS, MAX_LOG_ENTRIES, sanitizeLogLine, describeEdgeFailure } from "./actionsLogsTypes";
import type { UseGitHubActionsLogsOptions, UseGitHubActionsLogsResult, LogEntry, WorkflowRun } from "./actionsLogsTypes";
export type { LogEntry, WorkflowRun } from "./actionsLogsTypes";

export function useGitHubActionsLogs({
  githubRepo,
  runId,
  workflowId = "k1w1-triggered-build.yml",
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
  const requestKeyRef = useRef<string>("");
  const activeRequestKeyRef = useRef<string>("");
  const requestVersionRef = useRef(0);
  const activeRequestVersionRef = useRef(0);
  const pendingRequestVersionRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchLogs = useCallback(async () => {
    const requestKey = `${githubRepo || ""}::${String(runId ?? "latest")}::${workflowId}`;

    if (!githubRepo) {
      setError("Kein GitHub Repo ausgewählt");
      return;
    }
    if (isFetchPendingRef.current) return;

    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    requestKeyRef.current = requestKey;
    activeRequestKeyRef.current = requestKey;
    activeRequestVersionRef.current = requestVersion;
    pendingRequestVersionRef.current = requestVersion;
    isFetchPendingRef.current = true;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);
    loggedErrorRef.current = false;

    try {
      // Fetch latest workflow run if no runId provided
      let targetRunId = runId;
      const edgeUrl = await requireSupabaseEdgeUrl();
      const edgeAdminKey = await getEdgeAdminKey().catch(() => null);

      if (!targetRunId) {
      const runsResponse = await fetch(
        `${edgeUrl}/${SUPABASE_EDGE_FUNCTIONS.GITHUB_WORKFLOW_RUNS}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(edgeAdminKey ? { "x-k1w1-admin-key": edgeAdminKey } : {}),
          },
          body: JSON.stringify({ githubRepo, workflowId }),
          signal: controller.signal,
        },
      );

        if (!runsResponse.ok) {
          throw new Error(
            await describeEdgeFailure({
            fnName: SUPABASE_EDGE_FUNCTIONS.GITHUB_WORKFLOW_RUNS,
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
          if (
            isMountedRef.current &&
            requestKeyRef.current === requestKey &&
            activeRequestVersionRef.current === requestVersion
          ) {
            setWorkflowRun(runs[0]);
          }
        } else {
          if (
            isMountedRef.current &&
            requestKeyRef.current === requestKey &&
            activeRequestVersionRef.current === requestVersion
          ) {
            setLogs([]);
            setIsLoading(false);
          }
          return;
        }
      }

      // Fetch logs for the workflow run
      const logsResponse = await fetch(
        `${edgeUrl}/${SUPABASE_EDGE_FUNCTIONS.GITHUB_WORKFLOW_LOGS}`,
        {
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
        signal: controller.signal,
        },
      );

      if (!logsResponse.ok) {
        throw new Error(
          await describeEdgeFailure({
            fnName: SUPABASE_EDGE_FUNCTIONS.GITHUB_WORKFLOW_LOGS,
            res: logsResponse,
            edgeUrl,
            hasAdminKey: !!edgeAdminKey,
          }),
        );
      }

      const logsData = await logsResponse.json();

      if (
        isMountedRef.current &&
        requestKeyRef.current === requestKey &&
        activeRequestVersionRef.current === requestVersion
      ) {
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

        // backend versions may return run metadata under either `workflowRun` or `run`.
        // normalize here so UI can always trust GitHub status/conclusion.
        const runMeta = logsData?.workflowRun ?? logsData?.run;
        if (runMeta) {
          setWorkflowRun(runMeta);
        }
       }
    } catch (err: unknown) {
      // Nur einmal loggen (nicht bei jedem Poll-Versuch)
      if (
        err instanceof Error &&
        err.name === "AbortError"
      ) {
        return;
      }
      if (
        isMountedRef.current &&
        requestKeyRef.current === requestKey &&
        activeRequestVersionRef.current === requestVersion &&
        !loggedErrorRef.current
      ) {
        logger.warn(
          "[useGitHubActionsLogs] ⚠️ Logs nicht verfügbar:",
          err instanceof Error ? err.message : String(err),
        );
        loggedErrorRef.current = true;
      }
      if (
        isMountedRef.current &&
        requestKeyRef.current === requestKey &&
        activeRequestVersionRef.current === requestVersion
      ) {
        setError(err instanceof Error ? err.message : "Fehler beim Abrufen der Logs");
      }
    } finally {
      if (
        isMountedRef.current &&
        requestKeyRef.current === requestKey &&
        activeRequestVersionRef.current === requestVersion
      ) {
        setIsLoading(false);
      }
      if (pendingRequestVersionRef.current === requestVersion) {
        pendingRequestVersionRef.current = null;
        isFetchPendingRef.current = false;
      }
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [githubRepo, runId, workflowId]);

  const refreshLogs = useCallback(async () => {
    await fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh effect - uses workflowRun ref to avoid stale closure issues
  const workflowStatusRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    workflowStatusRef.current = workflowRun?.status;
  }, [workflowRun?.status]);

  useEffect(() => {
    const nextRequestKey = `${githubRepo || ""}::${String(runId ?? "latest")}::${workflowId}`;
    requestKeyRef.current = nextRequestKey;

    const hasPendingStaleRequest =
      isFetchPendingRef.current &&
      pendingRequestVersionRef.current != null &&
      activeRequestKeyRef.current !== nextRequestKey;

    if (hasPendingStaleRequest) {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      pendingRequestVersionRef.current = null;
      isFetchPendingRef.current = false;
    }

    setLogs([]);
    setWorkflowRun(null);
    setError(null);
    setIsLoading(false);

    if (!githubRepo) {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      pendingRequestVersionRef.current = null;
      isFetchPendingRef.current = false;
    }
  }, [githubRepo, runId, workflowId]);

  useEffect(() => {
    if (!githubRepo) {
      return;
    }

    if (!autoRefresh) {
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
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      pendingRequestVersionRef.current = null;
      isFetchPendingRef.current = false;
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
