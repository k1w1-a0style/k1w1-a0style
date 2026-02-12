import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking } from "react-native";

import { useProject } from "../../../contexts/ProjectContext";
import { useGitHub } from "../../../contexts/GitHubContext";
import { useBuildHistory } from "../../../hooks/useBuildHistory";
import { useGitHubActionsLogs } from "../../../hooks/useGitHubActionsLogs";
import { BuildErrorAnalyzer } from "../../../lib/buildErrorAnalyzer";
import { CONFIG } from "../../../config";
import type { BuildStatus } from "../../../lib/buildStatusMapper";
import {
  computeEta,
  formatDuration,
  getStatusIcon,
} from "../../../utils/buildScreenUtils";
import { redactSecrets, truncateWithMarker } from "../../../lib/secretRedaction";

import type {
  BuildProfile,
  CurrentBuildLike,
  WorkflowRun,
  WorkflowRunsResponse,
} from "../types";

const FETCH_TIMEOUT_MS = 15_000;
export const MAX_RUNS_DISPLAY = 10;
const MAX_ALERT_MESSAGE_LEN = 600;

function sanitizeUiMessage(input: string): string {
  const redacted = redactSecrets(input || "");
  return truncateWithMarker(redacted, MAX_ALERT_MESSAGE_LEN, "…");
}

type RepoValidation =
  | { valid: true; owner: string; repo: string; normalized: string }
  | { valid: false; error: string; normalized: string };

function validateRepoFullName(input: string): RepoValidation {
  const normalized = (input || "").trim();
  if (!normalized) {
    return { valid: false, error: "Repo darf nicht leer sein.", normalized };
  }
  const parts = normalized.split("/");
  if (parts.length !== 2) {
    return {
      valid: false,
      error: 'Format muss "owner/repo" sein (genau ein /).',
      normalized,
    };
  }
  const [owner, repo] = parts;
  if (!owner || !repo) {
    return {
      valid: false,
      error: "Owner und Repo dürfen nicht leer sein.",
      normalized,
    };
  }
  // GitHub naming rules (pragmatic): letters, numbers, dots, underscores, hyphens.
  const re = /^[A-Za-z0-9._-]+$/;
  if (!re.test(owner)) {
    return {
      valid: false,
      error: "Ungültige Zeichen im Owner.",
      normalized,
    };
  }
  if (!re.test(repo)) {
    return {
      valid: false,
      error: "Ungültige Zeichen im Repo-Namen.",
      normalized,
    };
  }
  return { valid: true, owner, repo, normalized };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Timeout")), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

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
  const { activeBranch, setActiveRepo, setActiveBranch } = useGitHub();
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
  const setLinkedRepo = projectContext?.setLinkedRepo as
    | undefined
    | ((repo: string | null, branch?: string | null) => Promise<void>);
  const setPreferredBuildProfile = projectContext?.setPreferredBuildProfile as
    | undefined
    | ((profile: BuildProfile) => Promise<void>);

  const initialRepo = useMemo(() => {
    return (
      projectData?.linkedRepo?.trim() ||
      (currentBuild?.githubRepo ?? "").trim() ||
      CONFIG.BUILD.GITHUB_REPO
    );
  }, [currentBuild?.githubRepo, projectData?.linkedRepo]);

  const initialBranch = useMemo(() => {
    return projectData?.linkedBranch?.trim() || activeBranch?.trim() || "work";
  }, [projectData?.linkedBranch, activeBranch]);

  const [repoFullName, setRepoFullName] = useState(initialRepo);
  const [branchName, setBranchName] = useState(initialBranch);
  const [buildProfile, setBuildProfile] = useState<BuildProfile>(
    (projectData?.preferredBuildProfile as any) || "preview",
  );
  const [loadingRuns, setLoadingRuns] = useState(false);

  // Sync persisted profile/branch when project loads or changes
  useEffect(() => {
    const p = projectData?.preferredBuildProfile;
    if (p === "development" || p === "preview" || p === "production") {
      setBuildProfile(p);
    }
  }, [projectData?.preferredBuildProfile]);

  useEffect(() => {
    const b = initialBranch?.trim();
    if (b) setBranchName(b);
  }, [initialBranch]);

  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [buildLoading, setBuildLoading] = useState(false);
  const [savingRepo, setSavingRepo] = useState(false);
  const [buildStartTime, setBuildStartTime] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState<number>(0);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  useEffect(() => {
    setRepoFullName(initialRepo);
  }, [initialRepo]);

  const {
    history,
    stats,
    isLoading: historyLoading,
    clearHistory,
  } = useBuildHistory();

  const jobId = currentBuild?.jobId ?? null;
  const repoValidation = useMemo(() => validateRepoFullName(repoFullName), [repoFullName]);
  const normalizedRepo = repoValidation.normalized;
  const runId = currentBuild?.runId ?? null;
  const status: BuildStatus = (currentBuild?.status as any) ?? "idle";

  // Logs nur laden wenn ein aktiver Build läuft oder eine runId existiert
  const shouldLoadLogs =
    status === "queued" ||
    status === "building" ||
    (runId !== null && status !== "idle");

  const githubRepoForLogs = shouldLoadLogs
    ? currentBuild?.githubRepo?.trim() || normalizedRepo || null
    : null;

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
  const hasSetLinkedRepo = typeof setLinkedRepo === "function";

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
    } finally {
      if (isMountedRef.current) setRefreshing(false);
    }
  }, [canFetch, fetchRuns, hasGetWorkflowRuns]);

  const onStartBuild = useCallback(async () => {
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
  }, [buildProfile, hasStartBuild, startBuild]);

  const onSaveLinkedRepo = useCallback(async () => {
    if (!hasSetLinkedRepo || !setLinkedRepo) {
      Alert.alert("Nicht verfügbar", "setLinkedRepo() ist nicht verfügbar.");
      return;
    }
    const v = repoFullName.trim();
    const vRes = validateRepoFullName(v);
    if (!vRes.valid) {
      Alert.alert("Ungültig", sanitizeUiMessage(vRes.error));
      return;
    }
    if (isMountedRef.current) setSavingRepo(true);
    try {
      await setLinkedRepo(v, projectData?.linkedBranch ?? null);
      if (isMountedRef.current) {
        Alert.alert("✅ Gespeichert", `Repo verknüpft: ${v}`);
      }
    } catch (e) {
      if (isMountedRef.current) {
        Alert.alert(
          "❌ Fehler",
          sanitizeUiMessage(
            e instanceof Error ? e.message : "Konnte Repo nicht speichern",
          ),
        );
      }
    } finally {
      if (isMountedRef.current) setSavingRepo(false);
    }
  }, [hasSetLinkedRepo, projectData?.linkedBranch, repoFullName, setLinkedRepo]);

  const onSaveRepoBranch = useCallback(async () => {
    const repoValue = repoFullName.trim();
    const br = branchName.trim();
    const vRes = validateRepoFullName(repoValue);
    if (!vRes.valid) {
      Alert.alert("Ungültiges Repo", sanitizeUiMessage(vRes.error));
      return;
    }
    if (!br || br.length > 100 || br.includes("..") || br.startsWith("/") || br.endsWith("/")) {
      Alert.alert("Ungültiger Branch", "Bitte einen gültigen Branch-Namen eingeben.");
      return;
    }
    try {
      if (setLinkedRepo) await setLinkedRepo(repoValue, br);
      if (isMountedRef.current) {
        setActiveRepo(repoValue);
        setActiveBranch(br);
        Alert.alert(
          "✅ Gespeichert",
          `Repo/Branch verknüpft: ${repoValue} (${br})`,
        );
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[Build] Repo/Branch speichern fehlgeschlagen:", e);
      if (isMountedRef.current) {
        Alert.alert(
          "Fehler",
          sanitizeUiMessage("Repo/Branch konnte nicht gespeichert werden."),
        );
      }
    }
  }, [branchName, repoFullName, setActiveBranch, setActiveRepo, setLinkedRepo]);

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
    setRepoFullName,
    branchName,
    setBranchName,
    buildProfile,

    runs,
    error,
    refreshing,
    loadingRuns,
    savingRepo,
    buildLoading,
    hasGetWorkflowRuns,
    hasStartBuild,
    hasSetLinkedRepo,
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

    history,
    stats,
    historyLoading,
    clearHistory,

    fetchRuns,
    onRefresh,
    onStartBuild,
    onSaveLinkedRepo,
    onSaveRepoBranch,
    onSelectBuildProfile,
    openRun,
    formatDuration,
  };
}
