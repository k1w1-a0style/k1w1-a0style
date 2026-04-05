import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking } from "react-native";

import { useProject } from "../../../contexts/ProjectContext";
import { useBuildHistory } from "../../../hooks/useBuildHistory";
import { useGitHubActionsLogs } from "../../../hooks/useGitHubActionsLogs";
import { BuildErrorAnalyzer } from "../../../lib/buildErrorAnalyzer";
import type { BuildStatus } from "../../../shared/types/build";
import type { CheckItem } from "../components/ChecklistSection";
import {
  computeEta,
  formatDuration,
} from "../../../utils/buildScreenUtils";

import type {
  BuildProfile,
  CurrentBuildLike,
  WorkflowRun,
  WorkflowRunsResponse,
} from "../types";
import type { WorkflowJob, WorkflowRunDetails } from "../../../infra/github/workflows";

import {
  FETCH_TIMEOUT_MS,
  fetchRunDetailsBundle,
  resolveBuildStatusPresentation,
  resolveLogsLoadContext,
  sanitizeUiMessage,
  validateRepoFullName,
  withTimeout,
} from "./buildScreenHelpers";
import { useBuildPreconditions } from "./useBuildPreconditions";
import {
  countHiddenRuns,
  isBuildActive,
  isFinalBuildStatus,
  mapWorkflowLogsToLines,
  resolveHistoryMatchForRun,
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
  const runsReqIdRef = useRef(0); // verhindert Race-Conditions bei mehrfachen fetchRuns()

  // P1: Prevent duplicate build triggers on double-tap.
  const buildInFlightRef = useRef(false);
  const [buildInFlight, setBuildInFlight] = useState(false);

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
  const [loadingRuns, setLoadingRuns] = useState(false);

  // Runs & UI state
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [buildLoading, setBuildLoading] = useState(false);
  const [buildStartTime, setBuildStartTime] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState<number>(0);
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

  const filteredHistory = useMemo(() => {
    const all = buildHistory.history ?? [];
    if (historyFilter === "all") return all;
    const needle = String(historyFilter).toLowerCase();
    return all.filter(
      (h) => String(h.buildProfile || "").toLowerCase() === needle,
    );
  }, [buildHistory.history, historyFilter]);

  const filteredStats = useMemo(() => {
    const list = filteredHistory ?? [];
    return {
      total: list.length,
      success: list.filter((e) => e.status === "success").length,
      failed: list.filter((e) => e.status === "failed" || e.status === "error").length,
      building: list.filter(
        (e) => e.status === "building" || e.status === "queued",
      ).length,
    };
  }, [filteredHistory]);

  // Sync persisted profile when project loads or changes
  useEffect(() => {
    const p = projectData?.preferredBuildProfile;
    if (p === "development" || p === "preview" || p === "production") {
      setBuildProfile(p);
    }
  }, [projectData?.preferredBuildProfile]);

  // === Luxus: Run Detail Modal (Jobs/Details) ===
  const [runDetailVisible, setRunDetailVisible] = useState(false);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [runDetails, setRunDetails] = useState<WorkflowRunDetails | null>(null);
  const [runJobs, setRunJobs] = useState<WorkflowJob[]>([]);
  const [runDetailLoading, setRunDetailLoading] = useState(false);
  const [runDetailError, setRunDetailError] = useState<string | null>(null);
  const runDetailReqId = useRef(0);

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

  const canFetch = repoValidation.valid;
  const owner = repoValidation.valid ? repoValidation.owner : "";
  const repo = repoValidation.valid ? repoValidation.repo : "";

  const hasGetWorkflowRuns = typeof getWorkflowRuns === "function";
  const hasStartBuild = typeof startBuild === "function";
  // Build-Screen does not mutate repo/branch anymore.

  const fetchRuns = useCallback(async () => {
    const reqId = ++runsReqIdRef.current;
    if (!canFetch) {
      Alert.alert(
        "Ungültiges Repo",
        sanitizeUiMessage(
          repoValidation.valid
            ? "Unbekannter Fehler"
            : repoValidation.error || "Bitte Repo als owner/repo eintragen.",
        ),
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
        // ✅ Wichtig: App-getriggerte Builds laufen über k1w1-triggered-build.yml
        // -> getWorkflowRuns() default ist evtl. eas-build.yml, daher hier explizit:
        getWorkflowRuns(owner.trim(), repo.trim(), "k1w1-triggered-build.yml"),
        FETCH_TIMEOUT_MS,
      );
      const list = res?.workflow_runs ?? [];
      if (reqId !== runsReqIdRef.current) return;
      if (!isMountedRef.current) return;
      setRuns(Array.isArray(list) ? list : []);
      if (!list || list.length === 0) setError("Keine Workflow Runs gefunden.");
    } catch (e) {
      if (isMountedRef.current) {
        setRuns([]);
        setError(e instanceof Error ? sanitizeUiMessage(e.message) : "Konnte Runs nicht laden");
      }
    } finally {
      if (reqId === runsReqIdRef.current && isMountedRef.current) setLoadingRuns(false);
    }
  }, [canFetch, getWorkflowRuns, hasGetWorkflowRuns, owner, repo, repoValidation, sanitizeUiMessage]);

  const onRefresh = useCallback(async () => {
    if (!canFetch || !hasGetWorkflowRuns) return;
    if (isMountedRef.current) setRefreshing(true);
    try {
      await fetchRuns();
      await buildHistory.refresh().catch(() => {});
      await refreshPreconditions().catch(() => {});
    } finally {
      if (isMountedRef.current) setRefreshing(false);
    }
  }, [canFetch, fetchRuns, hasGetWorkflowRuns, buildHistory, refreshPreconditions]);

  const onStartBuild = useCallback(async () => {
    if (!repoValidation.valid) {
      Alert.alert(
        "Repo fehlt",
        sanitizeUiMessage(
          "Bitte zuerst im GitHub-Repos-Screen ein Repo (owner/repo) verknuepfen.",
        ),
      );
      return;
    }
    if (buildBlockedReason) {
      Alert.alert("Nicht bereit", sanitizeUiMessage(buildBlockedReason));
      return;
    }

    if (!hasStartBuild || !startBuild) {
      Alert.alert(
        "Nicht verfügbar",
        "startBuild() ist nicht im ProjectContext definiert.",
      );
      return;
    }
    if (buildInFlightRef.current) {
      // Sync guard: blocks double-tap before the UI has a chance to disable.
      return;
    }
    buildInFlightRef.current = true;
    if (isMountedRef.current) setBuildInFlight(true);

    if (isMountedRef.current) {
      setBuildLoading(true);
      setBuildStartTime(Date.now());
    }
    try {
      await startBuild(buildProfile);
      if (isMountedRef.current) {
        Alert.alert(
          "✅ Build gestartet",
          `Der Build wurde angestoßen (${buildProfile}).`,
        );
      }
    } catch (e) {
      if (isMountedRef.current) {
        setBuildStartTime(null);
        Alert.alert(
          "❌ Fehler",
          sanitizeUiMessage(e instanceof Error ? e.message : "Build fehlgeschlagen"),
        );
      }
    } finally {
      if (isMountedRef.current) {
        setBuildLoading(false);
        setBuildInFlight(false);
      }
      buildInFlightRef.current = false;
    }
  }, [repoValidation.valid, buildBlockedReason, buildProfile, hasStartBuild, startBuild, sanitizeUiMessage]);

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

  const findHistoryMatchForRun = useCallback(
    (run: WorkflowRun) => resolveHistoryMatchForRun(run, buildHistory.history),
    [buildHistory.history],
  );

  const openRunDetails = useCallback(
    async (run: WorkflowRun) => {
      if (!run || !repoValidation.valid) {
        if (run?.html_url) openRun(run.html_url);
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
    [repoValidation.valid, owner, repo, openRun, sanitizeUiMessage],
  );

  const refreshRunDetails = useCallback(async () => {
    if (!selectedRun) return;
    await openRunDetails(selectedRun);
  }, [selectedRun, openRunDetails]);


  const message = currentBuild?.message ?? "";
  const progress = currentBuild?.progress;

  // P2: make ETA feel alive by ticking while a build is active.
  useEffect(() => {
    const active = isBuildActive(status, buildStartTime);
    if (!active) return;

    const t = setInterval(() => {
      // Only update if still mounted.
      if (isMountedRef.current) setNowTick(Date.now());
    }, 1_000);
    return () => clearInterval(t);
  }, [buildStartTime, status]);

  // ETA berechnen wenn Build läuft
  const elapsedMs = useMemo(() => {
    if (!buildStartTime) return 0;
    return Date.now() - buildStartTime;
  }, [buildStartTime, nowTick]);

  const etaMs = useMemo(() => {
    if (status === "idle" || status === "success" || status === "failed" || status === "error") {
      return 0;
    }
    return computeEta(status, elapsedMs);
  }, [status, elapsedMs]);

  // Reset buildStartTime bei finalem Status
  useEffect(() => {
    if (isFinalBuildStatus(status)) {
      setBuildStartTime(null);
    }
  }, [status]);

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

  const canStartBuildUi = useMemo(() => {
    return (
      hasStartBuild &&
      !buildLoading &&
      !buildInFlight &&
      !buildBlockedReason
    );
  }, [hasStartBuild, buildLoading, buildInFlight, buildBlockedReason]);

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


  return {
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
    runMatch: selectedRun ? findHistoryMatchForRun(selectedRun) : null,
    formatDuration,
  };
}
