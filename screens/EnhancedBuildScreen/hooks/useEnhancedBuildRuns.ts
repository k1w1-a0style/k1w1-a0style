import { useCallback, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { Alert } from "react-native";

import type { BuildHistoryEntry } from "../../../shared/types/build";
import type { WorkflowJob, WorkflowRunDetails } from "../../../infra/github/workflows";
import type { WorkflowRun, WorkflowRunsResponse } from "../types";
import { FETCH_TIMEOUT_MS, fetchRunDetailsBundle, sanitizeUiMessage, withTimeout } from "./buildScreenHelpers";
import { resolveHistoryMatchForRun } from "./enhancedBuildScreenOrchestration";

type UseEnhancedBuildRunsParams = {
  canFetch: boolean;
  owner: string;
  repo: string;
  repoValidationError: string;
  getWorkflowRuns?: (
    owner: string,
    repo: string,
    workflowFileName?: string,
  ) => Promise<WorkflowRunsResponse>;
  isMountedRef: MutableRefObject<boolean>;
  openRun: (url: string) => Promise<void>;
  history: BuildHistoryEntry[] | null | undefined;
};

export function useEnhancedBuildRuns(params: UseEnhancedBuildRunsParams) {
  const {
    canFetch,
    owner,
    repo,
    repoValidationError,
    getWorkflowRuns,
    isMountedRef,
    openRun,
    history,
  } = params;

  const runsReqIdRef = useRef(0);
  const runDetailReqId = useRef(0);

  const [loadingRuns, setLoadingRuns] = useState(false);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [runDetailVisible, setRunDetailVisible] = useState(false);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [runDetails, setRunDetails] = useState<WorkflowRunDetails | null>(null);
  const [runJobs, setRunJobs] = useState<WorkflowJob[]>([]);
  const [runDetailLoading, setRunDetailLoading] = useState(false);
  const [runDetailError, setRunDetailError] = useState<string | null>(null);

  const hasGetWorkflowRuns = typeof getWorkflowRuns === "function";

  const fetchRuns = useCallback(async () => {
    const reqId = ++runsReqIdRef.current;
    if (!canFetch) {
      Alert.alert(
        "Ungültiges Repo",
        sanitizeUiMessage(repoValidationError || "Bitte Repo als owner/repo eintragen."),
      );
      return;
    }
    if (!hasGetWorkflowRuns || !getWorkflowRuns) {
      Alert.alert(
        "Nicht verfügbar",
        "getWorkflowRuns() ist nicht im ProjectContext definiert.",
      );
      return;
    }

    if (isMountedRef.current) {
      setLoadingRuns(true);
      setError(null);
    }

    try {
      const res = await withTimeout(
        getWorkflowRuns(owner.trim(), repo.trim(), "k1w1-triggered-build.yml"),
        FETCH_TIMEOUT_MS,
      );
      const list = res?.workflow_runs ?? [];
      if (reqId !== runsReqIdRef.current) return;
      if (!isMountedRef.current) return;
      setRuns(Array.isArray(list) ? list : []);
      if (!list || list.length === 0) setError("Keine Workflow Runs gefunden.");
    } catch (e) {
      if (reqId !== runsReqIdRef.current) return;
      if (!isMountedRef.current) return;
      setRuns([]);
      setError(e instanceof Error ? sanitizeUiMessage(e.message) : "Konnte Runs nicht laden");
    } finally {
      if (reqId === runsReqIdRef.current && isMountedRef.current) setLoadingRuns(false);
    }
  }, [canFetch, getWorkflowRuns, hasGetWorkflowRuns, owner, repo, repoValidationError, isMountedRef]);

  const openRunDetails = useCallback(
    async (run: WorkflowRun) => {
      if (!run || !canFetch) {
        if (run?.html_url) await openRun(run.html_url);
        return;
      }
      setSelectedRun(run);
      setRunDetailVisible(true);
      setRunDetails(null);
      setRunJobs([]);
      setRunDetailError(null);
      setRunDetailLoading(true);

      const reqId = ++runDetailReqId.current;
      try {
        const { details, jobs } = await fetchRunDetailsBundle(owner, repo, run.id);
        if (reqId !== runDetailReqId.current) return;
        if (!isMountedRef.current) return;
        setRunDetails(details);
        setRunJobs(jobs);
      } catch (e) {
        if (!isMountedRef.current) return;
        if (reqId !== runDetailReqId.current) return;
        setRunDetailError(
          e instanceof Error ? sanitizeUiMessage(e.message) : "Konnte Run-Details nicht laden",
        );
      } finally {
        if (!isMountedRef.current) return;
        if (reqId !== runDetailReqId.current) return;
        setRunDetailLoading(false);
      }
    },
    [canFetch, owner, repo, openRun, isMountedRef],
  );

  const refreshRunDetails = useCallback(async () => {
    if (!selectedRun) return;
    await openRunDetails(selectedRun);
  }, [selectedRun, openRunDetails]);

  const findHistoryMatchForRun = useCallback(
    (run: WorkflowRun) => resolveHistoryMatchForRun(run, history),
    [history],
  );

  return {
    hasGetWorkflowRuns,
    loadingRuns,
    runs,
    error,
    fetchRuns,

    runDetailVisible,
    setRunDetailVisible,
    selectedRun,
    runDetails,
    runJobs,
    runDetailLoading,
    runDetailError,
    openRunDetails,
    refreshRunDetails,
    findHistoryMatchForRun,
  };
}
