import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking } from "react-native";

import { useProject } from "../../../contexts/ProjectContext";
import { useBuildHistory } from "../../../hooks/useBuildHistory";
import { useGitHubActionsLogs } from "../../../hooks/useGitHubActionsLogs";
import { BuildErrorAnalyzer } from "../../../lib/buildErrorAnalyzer";
import type { BuildHistoryEntry, BuildStatus } from "../../../shared/types/build";
import type { CheckItem } from "../components/ChecklistSection";
import {
  computeEta,
  formatDuration,
  getStatusIcon,
} from "../../../utils/buildScreenUtils";

import type {
  BuildProfile,
  CurrentBuildLike,
  WorkflowRun,
  WorkflowRunsResponse,
} from "../types";
import type { WorkflowJob, WorkflowRunDetails } from "../../../infra/github/workflows";

import { FETCH_TIMEOUT_MS, fetchRunDetailsBundle, sanitizeUiMessage, validateRepoFullName, withTimeout } from "./buildScreenHelpers";
import { useBuildPreconditions } from "./useBuildPreconditions";

export const MAX_RUNS_DISPLAY = 10;

type BuildHistoryEntryWithBranch = BuildHistoryEntry & { branch?: string | null };

export function useEnhancedBuildScreen() {
  const runsReqIdRef = useRef(0); // verhindert Race-Conditions bei mehrfachen fetchRuns()

  // P1: Prevent duplicate build triggers on double-tap.
  const buildInFlightRef = useRef(false);

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

  type ModeFilter = "all" | BuildProfile;

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
    if (actionsFilter === "all") return runs;
    const needle = String(actionsFilter).toLowerCase();
    const re = new RegExp(`\\b${needle}\\b`, "i");
    const list = runs.filter((r) => {
      const title = String(r.display_title || "");
      const name = String(r.name || "");
      return re.test(title) || re.test(name);
    });
    // Backwards-compatible: older runs may not have a profile in the title yet.
    return list.length > 0 ? list : runs;
  }, [runs, actionsFilter]);

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
    hasDiagOk,
    hasCiLiteOk,
    ciLiteReason,
    ciLiteStale,
    refreshPreconditions,
  } = useBuildPreconditions(buildProfile, repoFullName, branchName, projectData);

  const buildBlockedReason = useMemo(() => {
    if (!repoValidation.valid) return "Repo fehlt (im Repo-Screen verknuepfen)";
    if (!branchName.trim()) return "Branch fehlt (im Repo-Screen auswaehlen)";
    if (!hasTokens) return "Tokens fehlen (GitHub + Expo) – im Verbindungen-Screen setzen";
    if (!hasDiagOk) return "Diagnostik nicht gruen – im Diagnostic-Screen ausfuehren";
    if (!hasCiLiteOk) {
      return ciLiteReason || "CI Lite nicht gruen oder nicht passend zu Repo/Branch – im Header ausfuehren";
    }
    if (!hasSigningKey) return "Signing Key fehlt – im Wizard generieren";
    return null;
  }, [repoValidation.valid, branchName, hasTokens, hasDiagOk, hasCiLiteOk, ciLiteReason, hasSigningKey]);

  // Logs nur laden wenn ein aktiver Build läuft oder eine runId existiert
  const shouldLoadLogs =
    status === "queued" ||
    status === "building" ||
    (runId !== null && status !== "idle");

  const githubRepoForLogs = shouldLoadLogs ? normalizedRepo || null : null;

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

  const logLines = useMemo(() => {
    if (!logs || logs.length === 0) return [];
    return logs.map((entry) => {
      // Show raw CLI output without extra prefixes
      if (entry.level === "raw") {
        return entry.message;
      }
      const ts = entry.timestamp;
      const time = ts ? new Date(ts).toLocaleTimeString() : "";
      const prefix = time ? `${time} ` : "";
      return `${prefix}[${entry.level}] ${entry.message}`;
    });
  }, [logs]);

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
          "Bitte zuerst im Repo-Screen ein Repo (owner/repo) verknuepfen.",
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
      if (isMountedRef.current) setBuildLoading(false);
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
    (run: WorkflowRun) => {
      const all = (buildHistory.history ?? []) as BuildHistoryEntryWithBranch[];
      const runUrl = String(run?.html_url || "");
      const runIdStr = String(run?.id || "");
      const hit = all.find((h) => {
        const html = String(h?.htmlUrl || "");
        if (html && runUrl && html === runUrl) return true;
        // Fallback: some sources store a shortened/redirected URL
        return html.includes(`/actions/runs/${runIdStr}`);
      });
      if (!hit) return null;
      return {
        jobId: hit.jobId ?? null,
        buildProfile: hit.buildProfile ?? null,
        branch: hit.branch ?? null,
        repoName: hit.repoName ?? null,
      };
    },
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
    [repoValidation.valid, owner, repo, openRun, runDetailReqId, isMountedRef, sanitizeUiMessage],
  );

  const refreshRunDetails = useCallback(async () => {
    if (!selectedRun) return;
    await openRunDetails(selectedRun);
  }, [selectedRun, openRunDetails]);


  const message = currentBuild?.message ?? "";
  const progress = currentBuild?.progress;

  // P2: make ETA feel alive by ticking while a build is active.
  useEffect(() => {
    const active =
      !!buildStartTime &&
      (status === "queued" || status === "building");
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
    if (status === "success" || status === "failed" || status === "error") {
      setBuildStartTime(null);
    }
  }, [status]);

  const statusEmoji = getStatusIcon(status);
  const statusLabel =
    status === "building" && typeof progress === "number"
      ? `${Math.round(progress * 100)}%`
      : status.toUpperCase();

  const moreCount =
    runs.length > MAX_RUNS_DISPLAY ? runs.length - MAX_RUNS_DISPLAY : 0;

  const onSelectBuildProfile = useCallback(
    async (p: BuildProfile) => {
      setBuildProfile(p);
      try {
        if (setPreferredBuildProfile) await setPreferredBuildProfile(p);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[Build] Konnte Build-Profil nicht persistieren:", e);
      }
    },
    [setPreferredBuildProfile],
  );

  const canStartBuildUi = useMemo(() => {
    return (
      hasStartBuild &&
      !buildLoading &&
      !buildInFlightRef.current &&
      !buildBlockedReason
    );
  }, [hasStartBuild, buildLoading, buildBlockedReason]);

  const checklistItems: CheckItem[] = useMemo(() => {
    const hasRepo = !!repoFullName.trim();
    const hasBranch = !!branchName.trim();
    return [
      {
        id: "signing_key",
        label: "Signing-Key bereit",
        status: hasSigningKey ? "ok" : "fail",
        detail: hasSigningKey ? `${buildProfile} · letzter bekannter Wizard-Stand` : "Fehlt noch - im Wizard prüfen oder erzeugen",
      },
      {
        id: "tokens",
        label: "Tokens vorhanden (GitHub + Expo)",
        status: hasTokens ? "ok" : "fail",
        detail: hasTokens ? undefined : "Im Verbindungen-Screen setzen",
      },
      {
        id: "diagnostic",
        label: "Diagnose erfolgreich",
        status: hasDiagOk ? "ok" : "pending",
        detail: hasDiagOk ? "Letzter bekannter Diagnose-Check: OK" : "Diagnose ausführen",
      },
      {
        id: "ci_lite",
        label: "Code-Checks grün (CI Lite)",
        status: hasCiLiteOk ? "ok" : ciLiteStale ? "fail" : "pending",
        detail: hasCiLiteOk
          ? "Letzter bekannter CI-Lite-Run: OK"
          : (ciLiteReason || "Im Header CI Lite ausführen"),
      },
      {
        id: "repo",
        label: "Repo gewaehlt",
        status: hasRepo ? "ok" : "fail",
        detail: hasRepo ? repoFullName : "Im Repo-Screen verknuepfen",
      },
      {
        id: "branch",
        label: "Branch gewaehlt",
        status: hasBranch ? "ok" : "fail",
        detail: hasBranch ? branchName : "Im Repo-Screen auswaehlen",
      },
      {
        id: "build_mode",
        label: `Build = ${buildProfile}`,
        status: "ok",
        detail: `Profil: ${buildProfile}`,
      },
    ];
  }, [
    hasSigningKey,
    hasTokens,
    hasDiagOk,
    hasCiLiteOk,
    ciLiteReason,
    ciLiteStale,
    repoFullName,
    branchName,
    buildProfile,
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
