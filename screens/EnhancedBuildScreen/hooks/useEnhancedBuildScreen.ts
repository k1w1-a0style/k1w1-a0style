import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking } from "react-native";

import { useProject } from "../../../contexts/ProjectContext";
import { useBuildHistory } from "../../../hooks/useBuildHistory";
import { useGitHubActionsLogs } from "../../../hooks/useGitHubActionsLogs";
import { BuildErrorAnalyzer } from "../../../lib/buildErrorAnalyzer";
import { runCleanupTask } from "../../../lib/safeCleanup";
import type { BuildStatus } from "../../../shared/types/build";
import type { CheckItem } from "../components/ChecklistSection";
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
  resolveLogsLoadContext,
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
  mapWorkflowLogsToLines,
} from "./enhancedBuildScreenOrchestration";
import {
  createChecklistItems,
  resolveBuildBlockedAction,
  type BuildBlockedAction,
} from "./enhancedBuildScreenReadiness";
import {
  filterWorkflowRunsByProfile,
  getWorkflowRunsEmptyStateText,
  type ModeFilter,
} from "./runFilterState";

export const MAX_RUNS_DISPLAY = 10;
const REPO_MISSING_BLOCK_REASON = "Repo fehlt (im GitHub-Repos-Screen verknuepfen)";
const BRANCH_MISSING_BLOCK_REASON = "Branch fehlt (im GitHub-Repos-Screen auswaehlen)";

export function useEnhancedBuildScreen() {

  // P1: Avoid state updates / alerts after unmount.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
  useEffect(() => {
    setActionsFilter((prev) => (prev === "all" ? prev : buildProfile));
    setHistoryFilter((prev) => (prev === "all" ? prev : buildProfile));
  }, [buildProfile]);

  const buildHistory = useBuildHistory();


  const filteredHistory = useMemo(() => {
    return filterBuildHistoryByMode(buildHistory.history, historyFilter);
  }, [buildHistory.history, historyFilter]);

  const filteredStats = useMemo(() => {
    return summarizeBuildHistoryStats(filteredHistory);
  }, [filteredHistory]);

  // Sync persisted profile when project loads or changes
  useEffect(() => {
    const p = projectData?.preferredBuildProfile;
    if (p === "development" || p === "preview" || p === "production") {
      setBuildProfile(p);
    }
  }, [projectData?.preferredBuildProfile]);


  const jobId = currentBuild?.jobId ?? null;
  const repoValidation = useMemo(() => validateRepoFullName(repoFullName), [repoFullName]);
  const normalizedRepo = repoValidation.normalized;
  const runId = currentBuild?.runId ?? null;
  const status: BuildStatus = currentBuild?.status ?? "idle";

  // === Checklist + Build-Preconditions ===
  const {
    hasTokens,
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

  const buildBlockedReason = useMemo(() => {
    if (!repoValidation.valid) return REPO_MISSING_BLOCK_REASON;
    if (!branchName.trim()) return BRANCH_MISSING_BLOCK_REASON;
    if (!hasTokens) return "Tokens fehlen (GitHub + Expo) – im Verbindungen-Screen setzen";
    if (!hasProjectFiles) return projectFilesReason || "Projekt ist leer – zuerst Dateien erzeugen oder importieren";
    if (!hasDiagOk) return diagnosticReason || "Diagnostik noch nicht sicher bestaetigt – im Diagnostic-Screen ausfuehren";
    if (!hasCiLiteOk) {
      return ciLiteReason || "CI Lite nicht gruen oder nicht passend zu Repo/Branch – im Header ausfuehren";
    }
    if (repoSyncState === "unknown") {
      return repoSyncReason || "Repo-Sync-Status unklar – bitte Repo-Änderungen explizit pushen und danach erneut prüfen";
    }
    if (!hasSigningKey) return signingKeyReason || "Signing Key fehlt – im Wizard generieren";
    return null;
  }, [repoValidation.valid, branchName, hasTokens, hasProjectFiles, projectFilesReason, hasDiagOk, diagnosticReason, hasCiLiteOk, ciLiteReason, repoSyncState, repoSyncReason, hasSigningKey, signingKeyReason]);

  const buildBlockedAction = useMemo<BuildBlockedAction | null>(() => {
    return resolveBuildBlockedAction({
      repoValidationValid: repoValidation.valid,
      branchName,
      hasTokens,
      hasDiagOk,
      hasCiLiteOk,
      repoSyncState,
      hasSigningKey,
      buildBlockedReason,
    });
  }, [repoValidation.valid, branchName, hasTokens, hasDiagOk, hasCiLiteOk, repoSyncState, hasSigningKey, buildBlockedReason]);

  const {
    shouldLoadLogs,
    githubRepoForLogs,
    logsWaitingReason,
  } = useMemo(() => resolveLogsLoadContext({
    selectedRepoFullName: normalizedRepo,
    currentBuildRepoFullName: currentBuild?.githubRepo ?? null,
    runId,
    status,
  }), [normalizedRepo, currentBuild?.githubRepo, runId, status]);

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

  const analyses = useMemo(() => {
    if (!logs || logs.length === 0) return [];
    return BuildErrorAnalyzer.analyzeLogs(logs);
  }, [logs]);

  const logsErrorSafe = useMemo(() => {
    return logsError ? sanitizeUiMessage(logsError) : null;
  }, [logsError]);

  const logLines = useMemo(() => mapWorkflowLogsToLines(logs), [logs]);

  const openRun = useCallback(async (url: string) => {
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Fehler", "URL kann nicht geöffnet werden.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Fehler", "Konnte URL nicht öffnen.");
    }
  }, []);


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


  const filteredRuns = useMemo(() => {
    return filterWorkflowRunsByProfile(runs, actionsFilter);
  }, [runs, actionsFilter]);

  const runsEmptyStateText = useMemo(() => {
    return getWorkflowRunsEmptyStateText({
      actionsFilter,
      filteredRunsCount: filteredRuns.length,
      allRunsCount: runs.length,
    });
  }, [actionsFilter, filteredRuns.length, runs.length]);
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

  const onRefresh = useCallback(async () => {
    if (!canFetch || !hasGetWorkflowRuns) return;
    if (isMountedRef.current) setRefreshing(true);
    try {
      await fetchRuns();
      await runCleanupTask(
        () => buildHistory.refresh(),
        "[EnhancedBuildScreen] background history refresh failed",
      );
      await runCleanupTask(
        () => refreshPreconditions(),
        "[EnhancedBuildScreen] background preconditions refresh failed",
      );
    } finally {
      if (isMountedRef.current) setRefreshing(false);
    }
  }, [canFetch, fetchRuns, hasGetWorkflowRuns, buildHistory, refreshPreconditions]);



  const message = currentBuild?.message ?? "";
  const progress = currentBuild?.progress;
  const { statusEmoji, statusLabel } = resolveBuildStatusPresentation({ status, progress });

  const moreCount = countHiddenRuns(filteredRuns.length, MAX_RUNS_DISPLAY);

  const onSelectBuildProfile = useCallback(
    async (p: BuildProfile) => {
      setBuildProfile(p);
      try {
        if (setPreferredBuildProfile) await setPreferredBuildProfile(p);
      } catch (e) {
        console.warn("[Build] Konnte Build-Profil nicht persistieren:", e);
      }
    },
    [setPreferredBuildProfile],
  );


  const checklistItems: CheckItem[] = useMemo(() => {
    return createChecklistItems({
      buildProfile,
      repoFullName,
      branchName,
      hasSigningKey,
      signingKeyReason,
      hasTokens,
      hasDiagOk,
      diagnosticReason,
      hasCiLiteOk,
      ciLiteReason,
      hasProjectFiles,
      projectFilesReason,
      repoSyncState,
      repoSyncReason,
      projectFilesCount: projectData?.files?.length ?? 0,
    });
  }, [
    buildProfile,
    repoFullName,
    branchName,
    hasSigningKey,
    signingKeyReason,
    hasTokens,
    hasDiagOk,
    diagnosticReason,
    hasCiLiteOk,
    ciLiteReason,
    hasProjectFiles,
    projectFilesReason,
    repoSyncState,
    repoSyncReason,
    projectData?.files?.length,
  ]);


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
