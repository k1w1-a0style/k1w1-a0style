// hooks/useGitHubActionsLogs.ts
// REFACTORED: types/helpers → actionsLogsTypes.ts

// hooks/useGitHubActionsLogs.ts - Real-time GitHub Actions log streaming
import { useEffect, useState, useCallback, useRef } from "react";
import { getEdgeAdminKey } from "../infra/github/githubService";
import { getGitHubToken } from "../infra/github/tokenStore";
import { redactSecrets, truncateWithMarker } from "../lib/secretRedaction";
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
      const edgeUrl = await requireSupabaseEdgeUrl();
      const edgeAdminKey = await getEdgeAdminKey().catch(() => null);
      const clientGithubToken = await getGitHubToken().catch(() => null);

      if (!targetRunId) {
      const runsResponse = await fetch(
        `${edgeUrl}/${SUPABASE_EDGE_FUNCTIONS.GITHUB_WORKFLOW_RUNS}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(edgeAdminKey ? { "x-k1w1-admin-key": edgeAdminKey } : {}),
          },
          body: JSON.stringify({ githubRepo, workflowId, githubToken: clientGithubToken ?? undefined }),
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
          setWorkflowRun(runs[0]);
        } else {
          setLogs([]);
          setIsLoading(false);
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
          githubToken: clientGithubToken ?? undefined,
        }),
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
        logger.warn(
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

