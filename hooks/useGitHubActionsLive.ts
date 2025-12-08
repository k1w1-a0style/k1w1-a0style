// hooks/useGitHubActionsLive.ts
// Live GitHub Actions Status & Logs Hook
// ✅ Holt detaillierten Workflow-Status
// ✅ Jobs und Steps mit Echtzeit-Updates
// ✅ Log-Stream Simulation
// ✅ Artifacts-Erkennung
// ✅ Progress-Berechnung

import { useEffect, useState, useRef, useCallback } from 'react';
import { getGitHubToken } from '../contexts/ProjectContext';
import {
  GitHubWorkflowRun,
  GitHubWorkflowJob,
  GitHubWorkflowStep,
  GitHubArtifact,
  BuildPhase,
  BuildStepInfo,
  LogLine,
  LiveBuildStatus,
} from '../contexts/types';

const POLL_INTERVAL_MS = 4000; // 4 Sekunden für schnellere Updates
const MAX_ERRORS = 5;

interface UseGitHubActionsLiveOptions {
  repoFullName: string | null;
  runId?: number | null;
  workflowFile?: string;
  autoStart?: boolean;
}

interface UseGitHubActionsLiveResult {
  status: LiveBuildStatus;
  isLoading: boolean;
  isPolling: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  // Workflow-spezifische Methoden
  cancelRun: () => Promise<boolean>;
  rerunRun: () => Promise<boolean>;
  getWorkflowRuns: (limit?: number) => Promise<GitHubWorkflowRun[]>;
}

const initialStatus: LiveBuildStatus = {
  phase: 'idle',
  steps: [],
  logs: [],
  artifacts: [],
  progress: 0,
};

export function useGitHubActionsLive(
  options: UseGitHubActionsLiveOptions
): UseGitHubActionsLiveResult {
  const { repoFullName, runId, workflowFile = 'eas-build.yml', autoStart = true } = options;

  const [status, setStatus] = useState<LiveBuildStatus>(initialStatus);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCount, setErrorCount] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const currentRunIdRef = useRef<number | null>(null);

  // ===================================
  // GitHub API Helper
  // ===================================
  const fetchGitHub = useCallback(
    async <T>(endpoint: string, method: string = 'GET'): Promise<T | null> => {
      const token = await getGitHubToken();
      if (!token) throw new Error('GitHub Token fehlt');

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch(`https://api.github.com${endpoint}`, {
        method,
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`GitHub API Error: ${response.status}`);
      }

      return await response.json();
    },
    []
  );

  // ===================================
  // Phase Mapping aus Steps
  // ===================================
  const mapPhaseFromSteps = useCallback((steps: GitHubWorkflowStep[]): BuildPhase => {
    // Finde den aktuell laufenden oder letzten Step
    const runningStep = steps.find(s => s.status === 'in_progress');
    const lastCompletedStep = [...steps]
      .reverse()
      .find(s => s.status === 'completed');

    const currentStepName = (runningStep?.name || lastCompletedStep?.name || '').toLowerCase();

    if (currentStepName.includes('checkout')) return 'checkout';
    if (currentStepName.includes('setup') || currentStepName.includes('node')) return 'setup';
    if (currentStepName.includes('install') || currentStepName.includes('npm')) return 'install';
    if (currentStepName.includes('build') || currentStepName.includes('eas')) return 'building';
    if (currentStepName.includes('upload') || currentStepName.includes('artifact')) return 'uploading';

    // Fallback basierend auf Status
    if (steps.every(s => s.status === 'completed' && s.conclusion === 'success')) {
      return 'success';
    }
    if (steps.some(s => s.conclusion === 'failure')) {
      return 'failed';
    }

    return 'building';
  }, []);

  // ===================================
  // Progress Berechnung
  // ===================================
  const calculateProgress = useCallback((steps: GitHubWorkflowStep[]): number => {
    if (steps.length === 0) return 0;

    const completedSteps = steps.filter(s => s.status === 'completed').length;
    const inProgressSteps = steps.filter(s => s.status === 'in_progress').length;

    // Completed + halbe in-progress
    const progress = ((completedSteps + inProgressSteps * 0.5) / steps.length) * 100;
    return Math.min(Math.round(progress), 100);
  }, []);

  // ===================================
  // Steps zu BuildStepInfo konvertieren
  // ===================================
  const convertSteps = useCallback((steps: GitHubWorkflowStep[]): BuildStepInfo[] => {
    return steps.map(step => {
      let stepStatus: BuildStepInfo['status'] = 'pending';

      if (step.status === 'completed') {
        stepStatus = step.conclusion === 'success' ? 'success' :
          step.conclusion === 'skipped' ? 'skipped' : 'failed';
      } else if (step.status === 'in_progress') {
        stepStatus = 'running';
      }

      // Duration berechnen
      let duration: number | undefined;
      if (step.started_at && step.completed_at) {
        const start = new Date(step.started_at).getTime();
        const end = new Date(step.completed_at).getTime();
        duration = Math.round((end - start) / 1000);
      }

      return {
        name: step.name,
        status: stepStatus,
        startedAt: step.started_at,
        completedAt: step.completed_at,
        duration,
      };
    });
  }, []);

  // ===================================
  // Log-Lines aus Steps generieren
  // ===================================
  const generateLogLines = useCallback((
    run: GitHubWorkflowRun | undefined,
    job: GitHubWorkflowJob | undefined,
    steps: GitHubWorkflowStep[]
  ): LogLine[] => {
    const logs: LogLine[] = [];

    // Run gestartet
    if (run?.run_started_at) {
      logs.push({
        timestamp: run.run_started_at,
        level: 'info',
        message: `🚀 Workflow "${run.name}" gestartet (Run #${run.run_number})`,
      });
    }

    // Job gestartet
    if (job?.started_at) {
      logs.push({
        timestamp: job.started_at,
        level: 'info',
        message: `📦 Job "${job.name}" gestartet${job.runner_name ? ` auf ${job.runner_name}` : ''}`,
      });
    }

    // Steps
    for (const step of steps) {
      if (step.started_at) {
        logs.push({
          timestamp: step.started_at,
          level: 'info',
          message: `▶️ Step: ${step.name}`,
          stepName: step.name,
        });
      }

      if (step.status === 'completed' && step.completed_at) {
        const icon = step.conclusion === 'success' ? '✅' :
          step.conclusion === 'skipped' ? '⏭️' : '❌';
        const level = step.conclusion === 'failure' ? 'error' :
          step.conclusion === 'skipped' ? 'warn' : 'info';

        logs.push({
          timestamp: step.completed_at,
          level,
          message: `${icon} ${step.name} - ${step.conclusion || 'completed'}`,
          stepName: step.name,
        });
      }
    }

    // Job abgeschlossen
    if (job?.completed_at) {
      const icon = job.conclusion === 'success' ? '🎉' : '💥';
      logs.push({
        timestamp: job.completed_at,
        level: job.conclusion === 'success' ? 'info' : 'error',
        message: `${icon} Job "${job.name}" ${job.conclusion}`,
      });
    }

    // Sortieren nach Timestamp
    return logs.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, []);

  // ===================================
  // Status abrufen
  // ===================================
  const fetchStatus = useCallback(async () => {
    if (!repoFullName || !isMountedRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      let run: GitHubWorkflowRun | null = null;

      // Wenn runId vorhanden, direkt diesen Run abrufen
      if (runId || currentRunIdRef.current) {
        const targetRunId = runId || currentRunIdRef.current;
        run = await fetchGitHub<GitHubWorkflowRun>(
          `/repos/${repoFullName}/actions/runs/${targetRunId}`
        );
      }

      // Sonst den neuesten Run für den Workflow suchen
      if (!run) {
        const runsResponse = await fetchGitHub<{ workflow_runs: GitHubWorkflowRun[] }>(
          `/repos/${repoFullName}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?per_page=1`
        );

        if (runsResponse?.workflow_runs?.length) {
          run = runsResponse.workflow_runs[0];
          currentRunIdRef.current = run.id;
        }
      }

      if (!run) {
        setStatus({
          ...initialStatus,
          phase: 'idle',
          logs: [{
            timestamp: new Date().toISOString(),
            level: 'info',
            message: '📭 Kein aktiver Workflow-Run gefunden',
          }],
        });
        setErrorCount(0);
        return;
      }

      currentRunIdRef.current = run.id;

      // Jobs für den Run abrufen
      const jobsResponse = await fetchGitHub<{ jobs: GitHubWorkflowJob[] }>(
        `/repos/${repoFullName}/actions/runs/${run.id}/jobs`
      );

      const job = jobsResponse?.jobs?.[0] || null;
      const steps = job?.steps || [];

      // Artifacts abrufen (nur bei completed)
      let artifacts: GitHubArtifact[] = [];
      if (run.status === 'completed' && run.conclusion === 'success') {
        const artifactsResponse = await fetchGitHub<{ artifacts: GitHubArtifact[] }>(
          `/repos/${repoFullName}/actions/runs/${run.id}/artifacts`
        );
        artifacts = artifactsResponse?.artifacts || [];
      }

      // Phase ermitteln
      let phase: BuildPhase = 'idle';
      if (run.status === 'queued') {
        phase = 'queued';
      } else if (run.status === 'in_progress') {
        phase = mapPhaseFromSteps(steps);
      } else if (run.status === 'completed') {
        phase = run.conclusion === 'success' ? 'success' : 'failed';
      }

      // Status aktualisieren
      const buildSteps = convertSteps(steps);
      const logLines = generateLogLines(run, job || undefined, steps);
      const progress = calculateProgress(steps);

      // Duration berechnen
      let totalDuration: number | undefined;
      if (run.run_started_at) {
        const start = new Date(run.run_started_at).getTime();
        const end = run.status === 'completed'
          ? new Date(run.updated_at).getTime()
          : Date.now();
        totalDuration = Math.round((end - start) / 1000);
      }

      setStatus({
        phase,
        run,
        job: job || undefined,
        steps: buildSteps,
        logs: logLines,
        artifacts,
        progress: phase === 'success' ? 100 : progress,
        startedAt: run.run_started_at,
        completedAt: run.status === 'completed' ? run.updated_at : undefined,
        totalDuration,
      });

      setErrorCount(0);

      // Polling stoppen wenn abgeschlossen
      if (run.status === 'completed') {
        stopPolling();
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;

      console.error('[useGitHubActionsLive] Error:', err);
      const newErrorCount = errorCount + 1;
      setErrorCount(newErrorCount);
      setError(err?.message || 'Unbekannter Fehler');

      if (newErrorCount >= MAX_ERRORS) {
        stopPolling();
        setStatus(prev => ({
          ...prev,
          phase: 'error',
          logs: [
            ...prev.logs,
            {
              timestamp: new Date().toISOString(),
              level: 'error',
              message: `❌ Polling gestoppt nach ${MAX_ERRORS} Fehlern: ${err?.message}`,
            },
          ],
        }));
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [repoFullName, runId, workflowFile, errorCount, fetchGitHub, mapPhaseFromSteps, calculateProgress, convertSteps, generateLogLines]);

  // ===================================
  // Polling Control
  // ===================================
  const startPolling = useCallback(() => {
    if (intervalRef.current) return;

    setIsPolling(true);
    fetchStatus(); // Sofort einmal abrufen

    intervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        fetchStatus();
      }
    }, POLL_INTERVAL_MS);
  }, [fetchStatus]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // ===================================
  // Workflow Actions
  // ===================================
  const cancelRun = useCallback(async (): Promise<boolean> => {
    if (!repoFullName || !currentRunIdRef.current) return false;

    try {
      await fetchGitHub(
        `/repos/${repoFullName}/actions/runs/${currentRunIdRef.current}/cancel`,
        'POST'
      );
      await fetchStatus();
      return true;
    } catch (err) {
      console.error('[useGitHubActionsLive] Cancel error:', err);
      return false;
    }
  }, [repoFullName, fetchGitHub, fetchStatus]);

  const rerunRun = useCallback(async (): Promise<boolean> => {
    if (!repoFullName || !currentRunIdRef.current) return false;

    try {
      await fetchGitHub(
        `/repos/${repoFullName}/actions/runs/${currentRunIdRef.current}/rerun`,
        'POST'
      );
      await fetchStatus();
      return true;
    } catch (err) {
      console.error('[useGitHubActionsLive] Rerun error:', err);
      return false;
    }
  }, [repoFullName, fetchGitHub, fetchStatus]);

  const getWorkflowRuns = useCallback(async (limit: number = 10): Promise<GitHubWorkflowRun[]> => {
    if (!repoFullName) return [];

    try {
      const response = await fetchGitHub<{ workflow_runs: GitHubWorkflowRun[] }>(
        `/repos/${repoFullName}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?per_page=${limit}`
      );
      return response?.workflow_runs || [];
    } catch (err) {
      console.error('[useGitHubActionsLive] Get runs error:', err);
      return [];
    }
  }, [repoFullName, workflowFile, fetchGitHub]);

  // ===================================
  // Lifecycle
  // ===================================
  useEffect(() => {
    isMountedRef.current = true;

    if (autoStart && repoFullName) {
      startPolling();
    }

    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
  }, [repoFullName, autoStart, startPolling, stopPolling]);

  // RunId Änderung
  useEffect(() => {
    if (runId) {
      currentRunIdRef.current = runId;
      fetchStatus();
    }
  }, [runId, fetchStatus]);

  return {
    status,
    isLoading,
    isPolling,
    error,
    refresh: fetchStatus,
    startPolling,
    stopPolling,
    cancelRun,
    rerunRun,
    getWorkflowRuns,
  };
}

export default useGitHubActionsLive;
