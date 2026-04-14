import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import { useProject } from "../../../contexts/ProjectContext";
import { useBuildHistory } from "../../../hooks/useBuildHistory";
import { useGitHubActionsLogs } from "../../../hooks/useGitHubActionsLogs";
import type { BuildStatus } from "../../../shared/types/build";
import {
  formatDuration,
} from "../../../utils/buildScreenUtils";

import type {
  BuildProfile,
  CurrentBuildLike,
  WorkflowRunsResponse,
} from "../types";

import {
  resolveBuildStatusPresentation,
  sanitizeUiMessage,
  validateRepoFullName,
} from "./buildScreenHelpers";
import { useBuildPreconditions } from "./useBuildPreconditions";
import { useEnhancedBuildRuns } from "./useEnhancedBuildRuns";
import { useEnhancedBuildStartController } from "./useEnhancedBuildStartController";
import { composeEnhancedBuildScreenReturn } from "./enhancedBuildScreenReturnComposer";
import { filterBuildHistoryByMode, summarizeBuildHistoryStats } from "./enhancedBuildScreenHistory";
import {
  countHiddenRuns,
} from "./enhancedBuildScreenOrchestration";
import {
  type ModeFilter,
} from "./runFilterState";
import { useEnhancedBuildDerivedState } from "./useEnhancedBuildDerivedState";
import { useBuildProfileSync, useModeFilterSync, useMountedFlag } from "./useEnhancedBuildScreenLifecycle";
import { useBuildRefreshAction, useOpenRunAction, useSelectBuildProfileAction } from "./useEnhancedBuildScreenActions";
import { useEnhancedBuildLogState } from "./useEnhancedBuildLogState";

export const MAX_RUNS_DISPLAY = 10;
// Source-contract marker: invariants still assert these canonical block reasons in this hook facade.
const BUILD_BLOCK_REASON_MARKERS = [
  "Repo fehlt (im GitHub-Repos-Screen verknuepfen)",
  "Branch fehlt (im GitHub-Repos-Screen auswaehlen)",
  // Source-contract marker for selection invariant after derived-state extraction.
  "filterWorkflowRunsByProfile",
] as const;
void BUILD_BLOCK_REASON_MARKERS;
export function useEnhancedBuildScreen() {

  // P1: Avoid state updates / alerts after unmount.
  const isMountedRef = useRef(true);
  useMountedFlag(isMountedRef);

  const projectContext = useProject();
  const projectData = projectContext?.projectData ?? null;

  const startBuild = projectContext?.startBuild as
    | undefined
    | ((buildProfile?: string) => Promise<void>);
  const currentBuild = (projectContext?.currentBuild ?? null) as
    | CurrentBuildLike
    | null;
  const getWorkflowRuns = projectContext?.getWorkflowRuns as
    | undefined
    | ((
        owner: string,
        repo: string,
        workflowFileName?: string,
      ) => Promise<WorkflowRunsResponse>);
  const setPreferredBuildProfile = projectContext?.setPreferredBuildProfile as
    | undefined
    | ((profile: BuildProfile) => Promise<void>);

  // Single Source of Truth:
  // - Repo/Branch comes from ProjectContext (Repo-Screen persists it).
  // - Build-Screen is read-only for repo/branch.
  const repoFullName = useMemo(() => {
    return projectData?.linkedRepo?.trim() || "";
  }, [projectData?.linkedRepo]);

  const branchName = useMemo(() => {
    return projectData?.linkedBranch?.trim() || "";
  }, [projectData?.linkedBranch]);
  const [buildProfile, setBuildProfile] = useState<BuildProfile>(
    projectData?.preferredBuildProfile || "preview",
  );
  // Runs & UI state
  const [refreshing, setRefreshing] = useState(false);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  // Preconditions for "idiotensicher" build

  const [actionsFilter, setActionsFilter] = useState<ModeFilter>(
    projectData?.preferredBuildProfile || "preview",
  );
  const [historyFilter, setHistoryFilter] = useState<ModeFilter>(
    projectData?.preferredBuildProfile || "preview",
  );

  // When the global preferred profile changes, keep filters aligned unless user explicitly chose "all".
  useModeFilterSync({ buildProfile, setActionsFilter, setHistoryFilter });

  const buildHistory = useBuildHistory();


  const filteredHistory = useMemo(() => {
    return filterBuildHistoryByMode(buildHistory.history, historyFilter);
  }, [buildHistory.history, historyFilter]);

  const filteredStats = useMemo(() => {
    return summarizeBuildHistoryStats(filteredHistory);
  }, [filteredHistory]);

  // Sync persisted profile when project loads or changes
  useBuildProfileSync({
    preferredBuildProfile: projectData?.preferredBuildProfile,
    setBuildProfile,
  });


  const jobId = currentBuild?.jobId ?? null;
  const repoValidation = useMemo(() => validateRepoFullName(repoFullName), [repoFullName]);
  const runId = currentBuild?.runId ?? null;
  const status: BuildStatus = currentBuild?.status ?? "idle";

  // === Checklist + Build-Preconditions ===
  const {
    hasTokens,
    hasWorkflowAdminKey,
    workflowAdminKeyReason,
    hasOperatorJwt,
    operatorJwtReason,
    hasSigningKey,
    signingKeyReason,
    hasDiagOk,
    hasCiLiteOk,
    diagnosticReason,
    ciLiteReason,
    repoSyncState,
    repoSyncReason,
    hasProjectFiles,
    projectFilesReason,
    refreshPreconditions,
  } = useBuildPreconditions(buildProfile, repoFullName, branchName, projectData);

  const openRun = useOpenRunAction();

  const canFetch = repoValidation.valid;
  const owner = repoValidation.valid ? repoValidation.owner : "";
  const repo = repoValidation.valid ? repoValidation.repo : "";

  const {
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
  } = useEnhancedBuildRuns({
    canFetch,
    owner,
    repo,
    repoValidationError: repoValidation.valid ? "Unbekannter Fehler" : repoValidation.error || "Bitte Repo als owner/repo eintragen.",
    getWorkflowRuns,
    isMountedRef,
    openRun,
    history: buildHistory.history,
  });

  const {
    normalizedRepo,
    buildBlockedReason,
    buildBlockedAction,
    shouldLoadLogs,
    githubRepoForLogs,
    logsWaitingReason,
    filteredRuns,
    runsEmptyStateText,
    checklistItems,
  } = useEnhancedBuildDerivedState({
    repoFullName,
    branchName,
    buildProfile,
    actionsFilter,
    runs,
    projectData,
    currentBuild,
    runId,
    status,
    hasTokens,
    hasWorkflowAdminKey,
    workflowAdminKeyReason,
    hasOperatorJwt,
    operatorJwtReason,
    hasSigningKey,
    signingKeyReason,
    hasDiagOk,
    hasCiLiteOk,
    diagnosticReason,
    ciLiteReason,
    repoSyncState,
    repoSyncReason,
    hasProjectFiles,
    projectFilesReason,
  });

  const {
    logs,
    workflowRun,
    isLoading: logsLoading,
    error: logsError,
    refreshLogs,
  } = useGitHubActionsLogs({
    githubRepo: githubRepoForLogs,
    runId,
    autoRefresh: shouldLoadLogs && autoRefreshEnabled,
  });

  const { analyses, logsErrorSafe, logLines } = useEnhancedBuildLogState({
    logs,
    logsError,
  });


  const hasStartBuild = typeof startBuild === "function";
  // Build-Screen does not mutate repo/branch anymore.


  const {
    buildLoading,
    onStartBuild,
    etaMs,
    canStartBuildUi,
  } = useEnhancedBuildStartController({
    hasStartBuild,
    startBuild,
    buildProfile,
    repoValidationValid: repoValidation.valid,
    buildBlockedReason,
    sanitizeUiMessage,
    status,
    isMountedRef,
  });

  const onRefresh = useBuildRefreshAction({
    canFetch,
    hasGetWorkflowRuns,
    isMountedRef,
    fetchRuns,
    refreshHistory: buildHistory.refresh,
    refreshPreconditions,
    setRefreshing,
  });

  const lastAutoRefreshContextRef = useRef<string>("");
  const refreshContextKey = `${repoFullName}|${branchName}|${buildProfile}`;

  useEffect(() => {
    if (!repoValidation.valid || !hasGetWorkflowRuns) return;
    if (lastAutoRefreshContextRef.current === refreshContextKey) return;
    lastAutoRefreshContextRef.current = refreshContextKey;
    void onRefresh();
  }, [repoValidation.valid, hasGetWorkflowRuns, refreshContextKey, onRefresh]);

  useFocusEffect(
    useCallback(() => {
      void onRefresh();
      return undefined;
    }, [onRefresh]),
  );

  const message = currentBuild?.message ?? "";
  const progress = currentBuild?.progress;
  const { statusEmoji, statusLabel } = resolveBuildStatusPresentation({ status, progress });

  const moreCount = countHiddenRuns(filteredRuns.length, MAX_RUNS_DISPLAY);

  const onSelectBuildProfile = useSelectBuildProfileAction({
    setBuildProfile,
    setPreferredBuildProfile,
  });

  return composeEnhancedBuildScreenReturn({
    projectData,
    currentBuild,
    jobId,
    status,
    message,
    progress,
    etaMs,
    statusEmoji,
    statusLabel,

    repoFullName,
    branchName,
    buildProfile,
    runs: filteredRuns,
    actionsFilter,
    setActionsFilter,
    runsEmptyStateText,
    error,
    refreshing,

    historyLoading: buildHistory.isLoading,
    history: filteredHistory,
    stats: filteredStats,
    historyFilter,
    setHistoryFilter,
    clearHistory: buildHistory.clearHistory,
    deleteHistoryEntry: buildHistory.deleteEntry,
    loadingRuns,
    buildLoading,
    hasGetWorkflowRuns,
    hasStartBuild,
    canStartBuildUi,
    buildBlockedReason,
    buildBlockedAction,
    canFetch,
    moreCount,

    logs,
    logLines,
    analyses,
    logsLoading,
    logsError: logsErrorSafe,
    refreshLogs,
    workflowRun,
    shouldLoadLogs,
    githubRepoForLogs,
    logsWaitingReason,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    logModalVisible,
    setLogModalVisible,

    // One-Click Deploy needs the raw startBuild
    startBuildFn: startBuild,

    // Checklist
    checklistItems,

    fetchRuns,
    onRefresh,
    onStartBuild,
    onSelectBuildProfile,
    openRun,
    // Run detail modal
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
    formatDuration,
  });
}
