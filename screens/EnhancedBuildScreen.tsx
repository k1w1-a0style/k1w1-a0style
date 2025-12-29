// screens/EnhancedBuildScreen.tsx
import React, { useCallback, useMemo, useState } from "react";
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
import { styles } from "../styles/enhancedBuildScreenStyles";

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

type BuildStatus = "idle" | "pending" | "running" | "success" | "error";

interface CurrentBuild {
  status?: BuildStatus;
  message?: string;
  progress?: number; // 0..1
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
    | (() => Promise<void>);
  const currentBuild = projectContext?.currentBuild as undefined | CurrentBuild;
  const getWorkflowRuns = projectContext?.getWorkflowRuns as
    | undefined
    | ((owner: string, repo: string) => Promise<WorkflowRunsResponse>);

  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [buildLoading, setBuildLoading] = useState(false);

  const canFetch = useMemo(
    () => owner.trim().length > 0 && repo.trim().length > 0,
    [owner, repo],
  );
  const hasGetWorkflowRuns = typeof getWorkflowRuns === "function";
  const hasStartBuild = typeof startBuild === "function";

  const fetchRuns = useCallback(async () => {
    if (!canFetch) {
      Alert.alert(
        "Repo fehlt",
        "Bitte Owner und Repo eintragen (z.B. a0style / mein-repo).",
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
        getWorkflowRuns(owner.trim(), repo.trim()),
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
      await startBuild();
      Alert.alert("✅ Build gestartet", "Der Build wurde angestoßen.");
    } catch (e) {
      Alert.alert(
        "❌ Fehler",
        e instanceof Error ? e.message : "Build fehlgeschlagen",
      );
    } finally {
      setBuildLoading(false);
    }
  }, [hasStartBuild, startBuild]);

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

  const status = currentBuild?.status ?? "idle";
  const message = currentBuild?.message ?? "";
  const progress = currentBuild?.progress;

  const statusEmoji =
    status === "pending"
      ? "⏳"
      : status === "running"
        ? "🔄"
        : status === "success"
          ? "✅"
          : status === "error"
            ? "❌"
            : "⏸️";
  const statusLabel =
    status === "running" && typeof progress === "number"
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
            </View>
          </View>

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
          <Text style={styles.cardTitle}>GitHub Actions</Text>

          {!hasGetWorkflowRuns && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠️ getWorkflowRuns() ist nicht im ProjectContext definiert.
              </Text>
            </View>
          )}

          <View style={styles.inputRow}>
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Owner</Text>
              <TextInput
                value={owner}
                onChangeText={setOwner}
                placeholder="z.B. a0style"
                placeholderTextColor="#666"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>

            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Repository</Text>
              <TextInput
                value={repo}
                onChangeText={setRepo}
                placeholder="z.B. k1w1-a0style"
                placeholderTextColor="#666"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>
          </View>

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
                Gib Owner und Repo ein, um Workflow Runs zu laden.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
