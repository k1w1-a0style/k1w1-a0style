// screens/EnhancedBuildScreen.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";

import { useProject } from "../contexts/ProjectContext";
import { useBuildHistory } from "../hooks/useBuildHistory";
import { useGitHubActionsLogs } from "../hooks/useGitHubActionsLogs";
import { BuildTimelineCard } from "../components/build/BuildTimelineCard";
import { BuildLogsModal } from "../components/BuildLogsModal";
import { BuildErrorAnalyzer } from "../lib/buildErrorAnalyzer";
import {
  getSeverityColor,
  getWorkflowStatusColor,
  getWorkflowStatusText,
  formatRelativeTime,
  formatDuration,
  computeEta,
  getStatusIcon,
} from "../utils/buildScreenUtils";
import { styles } from "../styles/enhancedBuildScreenStyles";
import { CONFIG } from "../config";
import type { BuildStatus } from "../lib/buildStatusMapper";

interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  head_branch?: string;
}

interface WorkflowRunsResponse {
  total_count?: number;
  workflow_runs?: WorkflowRun[];
}

const FETCH_TIMEOUT_MS = 15_000;
const MAX_RUNS_DISPLAY = 10;

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

export default function EnhancedBuildScreen(): React.ReactElement {
  const runsReqIdRef = useRef(0); // verhindert Race-Conditions bei mehrfachen fetchRuns()

  const projectContext = useProject();
  const projectData = projectContext?.projectData ?? null;

  const startBuild = projectContext?.startBuild as
    | undefined
    | ((buildProfile?: string) => Promise<void>);
  const currentBuild = projectContext?.currentBuild ?? null;
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

  const initialRepo = useMemo(() => {
    return (
      projectData?.linkedRepo?.trim() ||
      (currentBuild?.githubRepo ?? "").trim() ||
      CONFIG.BUILD.GITHUB_REPO
    );
  }, [currentBuild?.githubRepo, projectData?.linkedRepo]);

  const [repoFullName, setRepoFullName] = useState(initialRepo);
  const [buildProfile, setBuildProfile] = useState<
    "development" | "preview" | "production"
  >("preview");
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [buildLoading, setBuildLoading] = useState(false);
  const [savingRepo, setSavingRepo] = useState(false);
  const [buildStartTime, setBuildStartTime] = useState<number | null>(null);
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
  const normalizedRepo = repoFullName.trim();
  const runId = currentBuild?.runId ?? null;
  const status: BuildStatus = currentBuild?.status ?? "idle";

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

  const canFetch = useMemo(
    () => normalizedRepo.length > 0 && normalizedRepo.includes("/"),
    [normalizedRepo],
  );
  const owner = useMemo(
    () => normalizedRepo.split("/")[0] || "",
    [normalizedRepo],
  );
  const repo = useMemo(
    () => normalizedRepo.split("/")[1] || "",
    [normalizedRepo],
  );

  const hasGetWorkflowRuns = typeof getWorkflowRuns === "function";
  const hasStartBuild = typeof startBuild === "function";
  const hasSetLinkedRepo = typeof setLinkedRepo === "function";

  const fetchRuns = useCallback(async () => {
    const reqId = ++runsReqIdRef.current;
    if (!canFetch) {
      Alert.alert(
        "Repo fehlt",
        "Bitte Repo als owner/repo eintragen (z.B. a0style/mein-repo).",
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

    setLoadingRuns(true);
    setError(null);

    try {
      const res = await withTimeout(
        // ✅ Wichtig: App-getriggerte Builds laufen über k1w1-triggered-build.yml
        // -> getWorkflowRuns() default ist evtl. eas-build.yml, daher hier explizit:
        getWorkflowRuns(owner.trim(), repo.trim(), "k1w1-triggered-build.yml"),
        FETCH_TIMEOUT_MS,
      );
      const list = res?.workflow_runs ?? [];
      if (reqId !== runsReqIdRef.current) return;
      setRuns(Array.isArray(list) ? list : []);
      if (!list || list.length === 0) setError("Keine Workflow Runs gefunden.");
    } catch (e) {
      setRuns([]);
      setError(e instanceof Error ? e.message : "Konnte Runs nicht laden");
    } finally {
      if (reqId === runsReqIdRef.current) setLoadingRuns(false);
    }
  }, [canFetch, getWorkflowRuns, hasGetWorkflowRuns, owner, repo]);

  const onRefresh = useCallback(async () => {
    if (!canFetch || !hasGetWorkflowRuns) return;
    setRefreshing(true);
    try {
      await fetchRuns();
    } finally {
      setRefreshing(false);
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
    setBuildLoading(true);
    setBuildStartTime(Date.now());
    try {
      await startBuild(buildProfile);
      Alert.alert(
        "✅ Build gestartet",
        `Der Build wurde angestoßen (${buildProfile}).`,
      );
    } catch (e) {
      setBuildStartTime(null);
      Alert.alert(
        "❌ Fehler",
        e instanceof Error ? e.message : "Build fehlgeschlagen",
      );
    } finally {
      setBuildLoading(false);
    }
  }, [buildProfile, hasStartBuild, startBuild]);

  const onSaveLinkedRepo = useCallback(async () => {
    if (!hasSetLinkedRepo || !setLinkedRepo) {
      Alert.alert("Nicht verfügbar", "setLinkedRepo() ist nicht verfügbar.");
      return;
    }
    const v = repoFullName.trim();
    if (!v || !v.includes("/")) {
      Alert.alert("Ungültig", "Bitte Repo im Format owner/repo eintragen.");
      return;
    }
    setSavingRepo(true);
    try {
      await setLinkedRepo(v, projectData?.linkedBranch ?? null);
      Alert.alert("✅ Gespeichert", `Repo verknüpft: ${v}`);
    } catch (e) {
      Alert.alert(
        "❌ Fehler",
        e instanceof Error ? e.message : "Konnte Repo nicht speichern",
      );
    } finally {
      setSavingRepo(false);
    }
  }, [
    hasSetLinkedRepo,
    projectData?.linkedBranch,
    repoFullName,
    setLinkedRepo,
  ]);

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

  // ETA berechnen wenn Build läuft
  const elapsedMs = useMemo(() => {
    if (!buildStartTime) return 0;
    return Date.now() - buildStartTime;
  }, [buildStartTime]);

  const etaMs = useMemo(() => {
    if (
      status === "idle" ||
      status === "success" ||
      status === "failed" ||
      status === "error"
    ) {
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

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00FF00"
            colors={["#00FF00"]}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>🛠️ Build</Text>
          <Text style={styles.subtitle}>
            {projectData?.name
              ? `Projekt: ${projectData.name}`
              : "Build-Status & GitHub Actions"}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Build Status</Text>

          <View style={styles.statusRow}>
            <Text style={styles.statusEmoji}>{statusEmoji}</Text>
            <View style={styles.statusTextWrap}>
              <Text style={styles.statusLabel}>{statusLabel}</Text>
              {!!message && <Text style={styles.statusMessage}>{message}</Text>}
              {!!jobId && (
                <Text style={styles.statusMessage}>Job ID: #{jobId}</Text>
              )}
              {etaMs > 0 && (
                <Text style={styles.statusMessage}>
                  ⏱️ Geschätzte Restzeit: {formatDuration(etaMs)}
                </Text>
              )}
            </View>
          </View>

          {/* Timeline (unified BuildStatus) */}
          <BuildTimelineCard status={status} />

          {!!currentBuild?.urls?.html && (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => openRun(currentBuild.urls?.html || "")}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>🔎 GitHub Run öffnen</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (!hasStartBuild || buildLoading) && styles.btnDisabled,
            ]}
            onPress={onStartBuild}
            disabled={!hasStartBuild || buildLoading}
          >
            {buildLoading ? (
              <ActivityIndicator color="#1a1a1a" />
            ) : (
              <Text style={styles.primaryBtnText}>🚀 Build starten</Text>
            )}
          </TouchableOpacity>

          {!hasStartBuild && (
            <Text style={styles.warningText}>
              Implementiere startBuild() in deinem ProjectContext
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Repo & Profile</Text>

          <View style={styles.inputRow}>
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>GitHub Repo (owner/repo)</Text>
              <TextInput
                value={repoFullName}
                onChangeText={setRepoFullName}
                placeholder="z.B. k1w1-pro-plus/k1w1-a0style"
                placeholderTextColor="#666"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.profileRow}>
            {(["development", "preview", "production"] as const).map((p) => {
              const active = buildProfile === p;
              const emoji =
                p === "development" ? "🔧" : p === "preview" ? "👁️" : "🚀";
              return (
                <TouchableOpacity
                  key={p}
                  style={[styles.profileBtn, active && styles.profileBtnActive]}
                  onPress={() => setBuildProfile(p)}
                  activeOpacity={0.8}
                  accessibilityLabel={`Build-Profile: ${p}`}
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.profileBtnText,
                      active && styles.profileBtnTextActive,
                    ]}
                  >
                    {emoji} {p}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (!hasSetLinkedRepo ||
                repoFullName.trim().length === 0 ||
                savingRepo) &&
                styles.btnDisabled,
            ]}
            onPress={onSaveLinkedRepo}
            disabled={
              !hasSetLinkedRepo ||
              repoFullName.trim().length === 0 ||
              savingRepo
            }
            accessibilityLabel="Repo speichern"
          >
            {savingRepo ? (
              <ActivityIndicator color="#1a1a1a" />
            ) : (
              <Text style={styles.primaryBtnText}>💾 Repo speichern</Text>
            )}
          </TouchableOpacity>

          {!hasSetLinkedRepo && (
            <Text style={styles.warningText}>
              ⚠️ setLinkedRepo() ist nicht verfügbar – Repo wird nicht
              persistent gespeichert.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>GitHub Actions</Text>

          {!hasGetWorkflowRuns && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠️ getWorkflowRuns() ist nicht im ProjectContext definiert.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (!canFetch || !hasGetWorkflowRuns || loadingRuns) &&
                styles.btnDisabled,
            ]}
            onPress={fetchRuns}
            disabled={!canFetch || !hasGetWorkflowRuns || loadingRuns}
          >
            {loadingRuns ? (
              <ActivityIndicator color="#1a1a1a" />
            ) : (
              <Text style={styles.primaryBtnText}>📥 Workflow Runs laden</Text>
            )}
          </TouchableOpacity>

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}

          {runs.length > 0 && (
            <View style={styles.runList}>
              {runs.slice(0, MAX_RUNS_DISPLAY).map((run) => {
                const c = getWorkflowStatusColor(run.status, run.conclusion);
                const t = getWorkflowStatusText(run.status, run.conclusion);
                const timeAgo = formatRelativeTime(run.created_at);

                return (
                  <TouchableOpacity
                    key={run.id}
                    style={styles.runItem}
                    onPress={() => openRun(run.html_url)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.runHeader}>
                      <View
                        style={[styles.statusDot, { backgroundColor: c }]}
                      />
                      <Text style={styles.runTitle} numberOfLines={1}>
                        {run.name || "Workflow"}
                      </Text>
                    </View>

                    <View style={styles.runMeta}>
                      <Text style={[styles.runStatus, { color: c }]}>{t}</Text>
                      <Text style={styles.runDivider}>•</Text>
                      <Text style={styles.runTime}>{timeAgo}</Text>
                      {!!run.head_branch && (
                        <>
                          <Text style={styles.runDivider}>•</Text>
                          <Text style={styles.runBranch} numberOfLines={1}>
                            {run.head_branch}
                          </Text>
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {moreCount > 0 && (
                <Text style={styles.moreText}>+ {moreCount} weitere Runs</Text>
              )}
            </View>
          )}

          {runs.length === 0 && !loadingRuns && !error && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                Trage ein Repo (owner/repo) ein, um Workflow Runs zu laden.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.cardTitle, { marginBottom: 0 }]}>
              Logs & Fehleranalyse
            </Text>

            <View style={styles.logActions}>
              <TouchableOpacity
                style={styles.inlineLink}
                onPress={() => setLogModalVisible(true)}
                disabled={logsLoading && logs.length === 0}
              >
                <Ionicons
                  name="terminal-outline"
                  size={16}
                  color={theme.palette.primary}
                />
                <Text style={styles.inlineLinkText}>Live in App</Text>
              </TouchableOpacity>

              {workflowRun?.html_url ? (
                <TouchableOpacity
                  style={styles.inlineLink}
                  onPress={() => Linking.openURL(workflowRun.html_url)}
                >
                  <Ionicons
                    name="open-outline"
                    size={16}
                    color={theme.palette.primary}
                  />
                  <Text style={styles.inlineLinkText}>Run</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {!shouldLoadLogs && status === "idle" && (
            <Text style={styles.emptyText}>
              ℹ️ Logs werden geladen sobald ein Build gestartet wird.
            </Text>
          )}

          {!githubRepoForLogs && shouldLoadLogs && (
            <Text style={styles.emptyText}>
              ⚠️ Kein Repo gesetzt – Logs können nicht geladen werden.
            </Text>
          )}

          {/* WorkflowRun-Status anzeigen wenn verfügbar */}
          {workflowRun && (
            <View style={styles.workflowStatusBox}>
              <View style={styles.runHeader}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: getWorkflowStatusColor(
                        workflowRun.status,
                        workflowRun.conclusion || null,
                      ),
                    },
                  ]}
                />
                <Text style={styles.runTitle}>
                  Run #{workflowRun.run_number}
                </Text>
              </View>
              <View style={styles.runMeta}>
                <Text
                  style={[
                    styles.runStatus,
                    {
                      color: getWorkflowStatusColor(
                        workflowRun.status,
                        workflowRun.conclusion || null,
                      ),
                    },
                  ]}
                >
                  {getWorkflowStatusText(
                    workflowRun.status,
                    workflowRun.conclusion || null,
                  )}
                </Text>
                <Text style={styles.runDivider}>•</Text>
                <Text style={styles.runTime}>
                  {formatRelativeTime(workflowRun.created_at)}
                </Text>
              </View>
            </View>
          )}

          {!!logsError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {logsError}</Text>
            </View>
          )}

          {logsLoading && <ActivityIndicator color="#00FF00" />}

          {analyses.length > 0 && (
            <View style={styles.analysisContainer}>
              {analyses.slice(0, 3).map((a, idx) => (
                <View
                  key={`${a.category}-${idx}`}
                  style={[
                    styles.runItem,
                    { borderColor: getSeverityColor(a.severity) },
                  ]}
                >
                  <Text style={styles.runTitle}>
                    {a.category} ({a.severity})
                  </Text>
                  <Text style={styles.runTime}>{a.description}</Text>
                  <Text style={styles.runTime}>💡 {a.suggestion}</Text>
                </View>
              ))}
            </View>
          )}

          {logs.length > 0 && (
            <View style={styles.logsContainer}>
              <Text style={styles.inputLabel}>
                Letzte Logs ({Math.min(logs.length, 20)} / {logs.length})
              </Text>
              <View style={styles.runList}>
                {logs.slice(-20).map((l, idx) => (
                  <View key={`${l.timestamp}-${idx}`} style={styles.runItem}>
                    <Text style={styles.runTime}>
                      {l.timestamp} • {l.level}
                    </Text>
                    <Text style={styles.runTitle}>{l.message}</Text>
                  </View>
                ))}
              </View>
              {!!workflowRun?.html_url && (
                <TouchableOpacity
                  style={[styles.primaryBtn, styles.logsBtnSpacing]}
                  onPress={() => openRun(workflowRun.html_url)}
                >
                  <Text style={styles.primaryBtnText}>↗️ Run öffnen</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Build-Historie</Text>

          {historyLoading ? (
            <ActivityIndicator color="#00FF00" />
          ) : (
            <>
              <Text style={styles.subtitle}>
                Gesamt: {stats.total} • ✅ {stats.success} • ❌ {stats.failed} •
                ⏳ {stats.building}
              </Text>

              <TouchableOpacity
                style={[styles.primaryBtn, styles.historyBtnSpacing]}
                onPress={clearHistory}
                accessibilityLabel="Build-Historie leeren"
              >
                <Text style={styles.primaryBtnText}>🗑️ Historie leeren</Text>
              </TouchableOpacity>

              {history.length > 0 && (
                <View style={styles.runList}>
                  {history.slice(0, 10).map((h) => {
                    const icon = getStatusIcon(h.status);
                    return (
                      <View key={h.id} style={styles.runItem}>
                        <View style={styles.runHeader}>
                          <Text style={styles.historyIcon}>{icon}</Text>
                          <Text style={styles.runTitle} numberOfLines={1}>
                            #{h.jobId} • {h.repoName}
                          </Text>
                        </View>
                        <View style={styles.runMeta}>
                          <Text style={styles.runTime}>
                            {h.status.toUpperCase()}
                          </Text>
                          {h.buildProfile && (
                            <>
                              <Text style={styles.runDivider}>•</Text>
                              <Text style={styles.runTime}>
                                {h.buildProfile}
                              </Text>
                            </>
                          )}
                          {typeof h.durationMs === "number" &&
                            h.durationMs > 0 && (
                              <>
                                <Text style={styles.runDivider}>•</Text>
                                <Text style={styles.runTime}>
                                  {formatDuration(h.durationMs)}
                                </Text>
                              </>
                            )}
                          <Text style={styles.runDivider}>•</Text>
                          <Text style={styles.runTime}>
                            {formatRelativeTime(h.startedAt)}
                          </Text>
                        </View>
                        {!!h.htmlUrl && (
                          <TouchableOpacity
                            onPress={() => openRun(h.htmlUrl || "")}
                            activeOpacity={0.7}
                            style={styles.historyLink}
                          >
                            <Text style={styles.moreText}>
                              ↗️ GitHub öffnen
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <BuildLogsModal
        visible={logModalVisible}
        onClose={() => setLogModalVisible(false)}
        logs={logLines}
        isLoading={logsLoading}
        error={logsError}
        onManualRefresh={refreshLogs}
        autoRefreshEnabled={shouldLoadLogs && autoRefreshEnabled}
        onToggleAutoRefresh={setAutoRefreshEnabled}
        defaultOnlyErrors={status === "failed" || status === "error"}
      />
    </SafeAreaView>
  );
}
