// hooks/useGitHubActionsLogs.ts - Real-time GitHub Actions log streaming
import { useEffect, useState, useCallback, useRef } from 'react';
import { CONFIG } from '../config';

export interface LogEntry {
  timestamp: string;
  message: string;
  level: 'info' | 'warning' | 'error';
  step?: string;
}

export interface WorkflowRun {
  id: number;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped';
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
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const fetchLogs = useCallback(async () => {
    if (!githubRepo) {
      setError('Kein GitHub Repo ausgewählt');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch latest workflow run if no runId provided
      let targetRunId = runId;
      
      if (!targetRunId) {
        const runsResponse = await fetch(
          `${CONFIG.API.SUPABASE_EDGE_URL}/github-workflow-runs`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ githubRepo }),
          }
        );

        if (!runsResponse.ok) {
          throw new Error('Workflow runs konnten nicht abgerufen werden');
        }

        const runsData = await runsResponse.json();
        
        if (runsData.runs && runsData.runs.length > 0) {
          targetRunId = runsData.runs[0].id;
          setWorkflowRun(runsData.runs[0]);
        } else {
          setLogs([]);
          setIsLoading(false);
          return;
        }
      }

      // Fetch logs for the workflow run
      const logsResponse = await fetch(
        `${CONFIG.API.SUPABASE_EDGE_URL}/github-workflow-logs`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            githubRepo,
            runId: targetRunId 
          }),
        }
      );

      if (!logsResponse.ok) {
        throw new Error('Logs konnten nicht abgerufen werden');
      }

      const logsData = await logsResponse.json();
      
      if (isMountedRef.current) {
        setLogs(logsData.logs || []);
        if (logsData.workflowRun) {
          setWorkflowRun(logsData.workflowRun);
        }
      }
    } catch (err: any) {
      console.error('[useGitHubActionsLogs] Error:', err);
      if (isMountedRef.current) {
        setError(err?.message || 'Fehler beim Abrufen der Logs');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
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
      if (currentStatus === 'in_progress' || currentStatus === 'queued' || !currentStatus) {
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
