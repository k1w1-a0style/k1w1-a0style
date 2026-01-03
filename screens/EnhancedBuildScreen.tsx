// screens/EnhancedBuildScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
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

import { useProject } from "../contexts/ProjectContext";
import { useBuildHistory } from "../hooks/useBuildHistory";
import { useGitHubActionsLogs } from "../hooks/useGitHubActionsLogs";
import { BuildTimelineCard } from "../components/build/BuildTimelineCard";
import { BuildErrorAnalyzer } from "../lib/buildErrorAnalyzer";
import { getSeverityColor } from "../utils/buildScreenUtils";
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

function getStatusColor(status: string, conclusion: string | null): string {
  if (status === "completed") {
    switch (conclusion) {
      case "success":
        return "#00FF00";
      case "failure":
        return "#FF4444";
      case "cancelled":
        return "#888888";
      default:
        return "#FFAA00";
    }
  }
  if (status === "in_progress" || status === "queued") return "#00AAFF";
  return "#666666";
}

function getStatusText(status: string, conclusion: string | null): string {
  if (status === "completed") return conclusion || "completed";
  return status;
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "gerade eben";
    if (diffMins < 60) return `vor ${diffMins} Min.`;
    if (diffHours < 24) return `vor ${diffHours} Std.`;
    if (diffDays < 7) return `vor ${diffDays} Tagen`;

    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  } catch {
    return dateString;
  }
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

export default function EnhancedBuildScreen(): React.ReactElement {
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
  const githubRepoForLogs =
    currentBuild?.githubRepo?.trim() || normalizedRepo || null;
  const runId = currentBuild?.runId ?? null;

  const {
    logs,
    workflowRun,
    isLoading: logsLoading,
    error: logsError,
  } = useGitHubActionsLogs({
    githubRepo: githubRepoForLogs,
    runId,
    autoRefresh: true,
  });

  const analyses = useMemo(() => {
    if (!logs || logs.length === 0) return [];
    return BuildErrorAnalyzer.analyzeLogs(logs);
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
      setRuns(Array.isArray(list) ? list : []);
      if (!list || list.length === 0) setError("Keine Workflow Runs gefunden.");
    } catch (e) {
      setRuns([]);
      setError(e instanceof Error ? e.message : "Konnte Runs nicht laden");
    } finally {
      setLoadingRuns(false);
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
    try {
      await startBuild(buildProfile);
      Alert.alert(
        "✅ Build gestartet",
        `Der Build wurde angestoßen (${buildProfile}).`,
      );
    } catch (e) {
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
    try {
      await setLinkedRepo(v, projectData?.linkedBranch ?? null);
      Alert.alert("✅ Gespeichert", `Repo verknüpft: ${v}`);
    } catch (e) {
      Alert.alert(
        "❌ Fehler",
        e instanceof Error ? e.message : "Konnte Repo nicht speichern",
      );
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

  const status: BuildStatus = currentBuild?.status ?? "idle";
  const message = currentBuild?.message ?? "";
  const progress = currentBuild?.progress;

  const statusEmoji =
    status === "queued"
      ? "⏳"
      : status === "building"
        ? "🔄"
        : status === "success"
          ? "✅"
          : status === "failed"
            ? "❌"
            : status === "error"
              ? "❌"
              : "⏸️";
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

          <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
            {(["development", "preview", "production"] as const).map((p) => {
              const active = buildProfile === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.primaryBtn,
                    { flex: 1 },
                    !active && { opacity: 0.65 },
                  ]}
                  onPress={() => setBuildProfile(p)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryBtnText}>{p}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (!hasSetLinkedRepo || repoFullName.trim().length === 0) &&
                styles.btnDisabled,
            ]}
            onPress={onSaveLinkedRepo}
            disabled={!hasSetLinkedRepo || repoFullName.trim().length === 0}
          >
            <Text style={styles.primaryBtnText}>💾 Repo speichern</Text>
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
                const c = getStatusColor(run.status, run.conclusion);
                const t = getStatusText(run.status, run.conclusion);
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
          <Text style={styles.cardTitle}>Logs & Fehleranalyse</Text>

          {!githubRepoForLogs && (
            <Text style={styles.emptyText}>
              ⚠️ Kein Repo gesetzt – Logs können nicht geladen werden.
            </Text>
          )}

          {!!logsError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {logsError}</Text>
            </View>
          )}

          {logsLoading && <ActivityIndicator color="#00FF00" />}

          {analyses.length > 0 && (
            <View style={{ marginTop: 12, gap: 10 }}>
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
            <View style={{ marginTop: 12 }}>
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
                  style={[styles.primaryBtn, { marginTop: 10 }]}
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
                style={[styles.primaryBtn, { marginTop: 12 }]}
                onPress={clearHistory}
              >
                <Text style={styles.primaryBtnText}>🗑️ Historie leeren</Text>
              </TouchableOpacity>

              {history.length > 0 && (
                <View style={styles.runList}>
                  {history.slice(0, 10).map((h) => (
                    <View key={h.id} style={styles.runItem}>
                      <Text style={styles.runTitle}>
                        #{h.jobId} • {h.repoName}
                      </Text>
                      <Text style={styles.runTime}>
                        {h.status.toUpperCase()}
                        {h.buildProfile ? ` • ${h.buildProfile}` : ""}
                      </Text>
                      {!!h.htmlUrl && (
                        <TouchableOpacity
                          onPress={() => openRun(h.htmlUrl || "")}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.moreText}>↗️ GitHub öffnen</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
