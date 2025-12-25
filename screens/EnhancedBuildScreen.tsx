/* eslint-disable react/no-unescaped-entities */
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  ActivityIndicator,
  Linking,
  Text,
  TouchableOpacity,
  View,
  Alert,
  ScrollView,
  RefreshControl,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBuildStatus } from "../hooks/useBuildStatus";
import { useBuildHistory } from "../hooks/useBuildHistory";
import { useGitHubActionsLogs } from "../hooks/useGitHubActionsLogs";
import { BuildErrorAnalyzer, ErrorAnalysis } from "../lib/buildErrorAnalyzer";
import { CONFIG } from "../config";
import { theme } from "../theme";
import { useGitHub } from "../contexts/GitHubContext";
import { useNotifications } from "../hooks/useNotifications";

// ✅ Extrahierte Module
import {
  STATUS_PROGRESS,
  STATUS_MESSAGES,
  formatDuration,
  computeEta,
  getSeverityColor,
  formatHistoryDate,
  getStatusIcon,
  getStatusColor,
} from "../utils/buildScreenUtils";
import { BuildTimelineCard } from "../components/build/BuildTimelineCard";
import { styles } from "../styles/enhancedBuildScreenStyles";

export default function EnhancedBuildScreen() {
  const { activeRepo } = useGitHub();
  const [jobId, setJobId] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [showLogs, setShowLogs] = useState(false);
  const [errorAnalyses, setErrorAnalyses] = useState<ErrorAnalysis[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Animated values for smooth progress bar
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Build History Hook
  const {
    history,
    stats,
    startBuild: addToHistory,
    completeBuild: updateHistory,
    deleteEntry: deleteFromHistory,
    clearHistory,
    refresh: refreshHistory,
    isLoading: historyLoading,
  } = useBuildHistory();

  // Notifications Hook
  const { notifyBuildSuccess, notifyBuildFailure, notifyBuildStarted } =
    useNotifications();

  const { status, details, lastError, isPolling } = useBuildStatus(jobId);

  // Extract runId from raw response if available
  const runId = details?.raw?.runId || details?.raw?.run_id || null;

  const {
    logs,
    isLoading: isLoadingLogs,
    error: logsError,
    refreshLogs,
  } = useGitHubActionsLogs({
    githubRepo: activeRepo,
    runId: runId,
    autoRefresh: status === "building" || status === "queued",
  });

  // Analyze errors when logs update
  useEffect(() => {
    if (logs.length > 0 && (status === "failed" || status === "error")) {
      const analyses = BuildErrorAnalyzer.analyzeLogs(logs);
      setErrorAnalyses(analyses);
    } else {
      setErrorAnalyses([]);
    }
  }, [logs, status]);

  // Animated progress bar
  const progress = useMemo(() => STATUS_PROGRESS[status] ?? 0, [status]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  // Pulse animation for active build indicator (optimized)
  useEffect(() => {
    if (status === "building" || status === "queued") {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => {
        pulse.stop();
        pulseAnim.setValue(1);
      };
    } else {
      pulseAnim.setValue(1);
    }
  }, [status, pulseAnim]);

  const startBuild = useCallback(
    async (profile: "development" | "preview" | "production" = "preview") => {
      if (!activeRepo) {
        Alert.alert(
          "Kein Repo ausgewählt",
          'Bitte wähle zuerst ein GitHub-Repo im „GitHub Repos"-Screen aus.',
        );
        return;
      }
      try {
        const res = await fetch(
          `${CONFIG.API.SUPABASE_EDGE_URL}/trigger-eas-build`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              githubRepo: activeRepo,
              buildProfile: profile,
              buildType: "normal",
            }),
          },
        );

        const json = await res.json();

        if (json.ok && json.job?.id) {
          const newJobId = json.job.id;
          setJobId(newJobId);
          setStartedAt(Date.now());
          setElapsedMs(0);
          setShowLogs(true);
          setErrorAnalyses([]);

          // ✅ Build zur Historie hinzufügen
          await addToHistory(newJobId, activeRepo, profile);

          // 📱 Notification senden
          await notifyBuildStarted(String(newJobId), "Android");
        } else {
          Alert.alert("Fehler", json?.error || "Fehler beim Start des Builds");
        }
      } catch (e: any) {
        Alert.alert(
          "Fehler",
          e?.message || "Build konnte nicht gestartet werden",
        );
      }
    },
    [activeRepo, addToHistory, notifyBuildStarted],
  );

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (jobId && startedAt && (status === "queued" || status === "building")) {
      timer = setInterval(() => {
        setElapsedMs(Date.now() - startedAt);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [jobId, startedAt, status]);

  useEffect(() => {
    if (!jobId) {
      setStartedAt(null);
      setElapsedMs(0);
    }
  }, [jobId]);

  // ✅ NEU: Build-Historie aktualisieren bei Status-Änderung + Notifications
  useEffect(() => {
    if (jobId && ["success", "failed", "error"].includes(status)) {
      updateHistory(jobId, status as "success" | "failed" | "error", {
        artifactUrl: details?.urls?.artifacts,
        htmlUrl: details?.urls?.html,
        errorMessage: lastError || undefined,
      });

      // 📱 Notifications senden
      if (status === "success") {
        notifyBuildSuccess(String(jobId), "Android");
      } else if (status === "failed" || status === "error") {
        notifyBuildFailure(
          String(jobId),
          lastError || "Unbekannter Fehler",
          "Android",
        );
      }
    }
  }, [
    jobId,
    status,
    details,
    lastError,
    updateHistory,
    notifyBuildSuccess,
    notifyBuildFailure,
  ]);

  const openUrl = useCallback((url?: string | null) => {
    if (!url) {
      Alert.alert("Fehler", "Kein Link verfügbar");
      return;
    }
    Linking.openURL(url).catch(() => {
      Alert.alert("Fehler", "Link konnte nicht geöffnet werden");
    });
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshLogs(), refreshHistory()]);
    setRefreshing(false);
  }, [refreshLogs, refreshHistory]);

  const resetBuild = useCallback(() => {
    Alert.alert(
      "🔄 Build zurücksetzen?",
      "Möchtest du den aktuellen Build-Status zurücksetzen und einen neuen Build starten?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Zurücksetzen",
          style: "destructive",
          onPress: () => {
            setJobId(null);
            setStartedAt(null);
            setElapsedMs(0);
            setShowLogs(false);
            setErrorAnalyses([]);
          },
        },
      ],
    );
  }, []);

  const eta = useMemo(() => computeEta(status, elapsedMs), [status, elapsedMs]);
  const errorSummary = useMemo(
    () => BuildErrorAnalyzer.generateSummary(errorAnalyses),
    [errorAnalyses],
  );
  const criticalError = useMemo(
    () => BuildErrorAnalyzer.getMostCriticalError(errorAnalyses),
    [errorAnalyses],
  );

  // Width interpolation for animated progress bar
  const animatedWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const handleDeleteHistoryEntry = useCallback(
    (jobIdToDelete: number) => {
      Alert.alert(
        "Eintrag löschen?",
        `Möchtest du Build #${jobIdToDelete} aus der Historie entfernen?`,
        [
          { text: "Abbrechen", style: "cancel" },
          {
            text: "Löschen",
            style: "destructive",
            onPress: () => deleteFromHistory(jobIdToDelete),
          },
        ],
      );
    },
    [deleteFromHistory],
  );

  const handleClearHistory = useCallback(() => {
    Alert.alert(
      "Historie löschen?",
      "Möchtest du die gesamte Build-Historie unwiderruflich löschen?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Alles löschen",
          style: "destructive",
          onPress: clearHistory,
        },
      ],
    );
  }, [clearHistory]);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.palette.primary}
            colors={[theme.palette.primary]}
          />
        }
      >
        <View style={styles.header}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Text style={styles.title}>🚀 Live Build Status</Text>
          </Animated.View>
          <Text style={styles.subtitle}>
            Starte einen Build und verfolge Warteschlange, Fortschritt und Dauer
            in Echtzeit.
          </Text>
        </View>

        {/* Repo Info Card - Show warning if no repo selected */}
        {activeRepo ? (
          <View style={styles.repoInfo}>
            <Text style={styles.repoLabel}>📂 Aktives Repository</Text>
            <Text style={styles.repoValue}>{activeRepo}</Text>
          </View>
        ) : (
          <View style={styles.noRepoCard}>
            <Text style={styles.noRepoIcon}>⚠️</Text>
            <Text style={styles.noRepoTitle}>Kein Repository ausgewählt</Text>
            <Text style={styles.noRepoText}>
              Wähle zuerst ein GitHub-Repo im „GitHub Repos"-Tab aus, bevor du
              einen Build starten kannst.
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={() => startBuild("development")}
            style={[
              styles.buildButton,
              !activeRepo && styles.buildButtonDisabled,
              (isPolling || status === "building") && styles.buildButtonActive,
            ]}
            disabled={!activeRepo || isPolling || status === "building"}
            activeOpacity={0.7}
          >
            {isPolling || status === "building" ? (
              <View style={styles.buildButtonContent}>
                <ActivityIndicator
                  color={theme.palette.secondary}
                  size="small"
                />
                <Text style={styles.buildButtonTextActive}>Build läuft...</Text>
              </View>
            ) : (
              <Text style={styles.buildButtonText}>🧪 Dev Build</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => startBuild("preview")}
            style={[
              styles.buildButton,
              !activeRepo && styles.buildButtonDisabled,
              (isPolling || status === "building") && styles.buildButtonActive,
            ]}
            disabled={!activeRepo || isPolling || status === "building"}
            activeOpacity={0.7}
          >
            {isPolling || status === "building" ? (
              <View style={styles.buildButtonContent}>
                <ActivityIndicator
                  color={theme.palette.secondary}
                  size="small"
                />
                <Text style={styles.buildButtonTextActive}>Build läuft...</Text>
              </View>
            ) : (
              <Text style={styles.buildButtonText}>📦 Preview APK</Text>
            )}
          </TouchableOpacity>

          {jobId && (
            <TouchableOpacity
              onPress={resetBuild}
              style={styles.resetButton}
              activeOpacity={0.7}
            >
              <Text style={styles.resetButtonText}>🔄</Text>
            </TouchableOpacity>
          )}
        </View>

        {!jobId && activeRepo && (
          <View style={styles.hintCard}>
            <Text style={styles.hintText}>
              💡 Noch kein Build aktiv. Starte oben einen Run, um Live-Daten zu
              sehen.
            </Text>
          </View>
        )}

        {jobId && (
          <>
            {/* Live Status Card */}
            <View style={styles.liveCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>📊 Live-Status</Text>
                <Text style={styles.cardMeta}>Job #{jobId}</Text>
              </View>

              <Text style={styles.statusText}>{STATUS_MESSAGES[status]}</Text>

              <View style={styles.progressBar}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    { width: animatedWidth },
                    status === "failed" && styles.progressFillError,
                    status === "success" && styles.progressFillSuccess,
                  ]}
                />
              </View>

              {/* Progress percentage indicator */}
              <Text style={styles.progressPercent}>
                {Math.round(progress * 100)}%
              </Text>

              <View style={styles.liveMetrics}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>⏱ Verstrichene Zeit</Text>
                  <Text style={styles.metricValue}>
                    {formatDuration(elapsedMs)}
                  </Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>⏳ Geschätzte Restzeit</Text>
                  <Text style={styles.metricValue}>
                    {status === "success" ? "0:00 min" : formatDuration(eta)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Timeline Card - Extracted Component */}
            <BuildTimelineCard status={status} />
            {/* Error Analysis Card */}
            {(status === "failed" || status === "error") &&
              errorAnalyses.length > 0 && (
                <View style={styles.errorAnalysisCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>🔍 Fehleranalyse</Text>
                    <Text
                      style={[styles.cardMeta, { color: theme.palette.error }]}
                    >
                      {errorSummary}
                    </Text>
                  </View>

                  {criticalError && (
                    <View style={[styles.errorItem, styles.errorItemCritical]}>
                      <View style={styles.errorItemHeader}>
                        <Text
                          style={[
                            styles.errorCategory,
                            { color: getSeverityColor(criticalError.severity) },
                          ]}
                        >
                          {criticalError.category}
                        </Text>
                        <Text
                          style={[
                            styles.errorSeverity,
                            { color: getSeverityColor(criticalError.severity) },
                          ]}
                        >
                          {criticalError.severity.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.errorDescription}>
                        {criticalError.description}
                      </Text>
                      <View style={styles.errorSuggestionBox}>
                        <Text style={styles.errorSuggestionLabel}>
                          💡 Lösung:
                        </Text>
                        <Text style={styles.errorSuggestion}>
                          {criticalError.suggestion}
                        </Text>
                      </View>
                      {criticalError.documentation && (
                        <TouchableOpacity
                          style={styles.docsButton}
                          onPress={() => openUrl(criticalError.documentation)}
                        >
                          <Text style={styles.docsButtonText}>
                            📖 Dokumentation öffnen
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {errorAnalyses.slice(1).map((error, idx) => (
                    <View key={idx} style={styles.errorItem}>
                      <View style={styles.errorItemHeader}>
                        <Text
                          style={[
                            styles.errorCategory,
                            { color: getSeverityColor(error.severity) },
                          ]}
                        >
                          {error.category}
                        </Text>
                        <Text
                          style={[
                            styles.errorSeverity,
                            { color: getSeverityColor(error.severity) },
                          ]}
                        >
                          {error.severity}
                        </Text>
                      </View>
                      <Text style={styles.errorDescription}>
                        {error.description}
                      </Text>
                      <Text style={styles.errorSuggestion}>
                        💡 {error.suggestion}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

            {/* GitHub Actions Logs Card */}
            <View style={styles.logsCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>📜 GitHub Actions Logs</Text>
                <TouchableOpacity
                  onPress={() => setShowLogs(!showLogs)}
                  style={styles.toggleButton}
                >
                  <Text style={styles.toggleButtonText}>
                    {showLogs ? "▼ Ausblenden" : "▶ Anzeigen"}
                  </Text>
                </TouchableOpacity>
              </View>

              {showLogs && (
                <>
                  {isLoadingLogs && (
                    <View style={styles.logsLoading}>
                      <ActivityIndicator color={theme.palette.primary} />
                      <Text style={styles.logsLoadingText}>
                        Logs werden geladen...
                      </Text>
                    </View>
                  )}

                  {logsError && (
                    <Text style={styles.logsError}>⚠️ {logsError}</Text>
                  )}

                  {logs.length > 0 && (
                    <ScrollView
                      style={styles.logsScrollContainer}
                      contentContainerStyle={styles.logsContent}
                      nestedScrollEnabled={true}
                      showsVerticalScrollIndicator={true}
                    >
                      {logs.slice(-50).map((log, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.logEntry,
                            log.level === "error" && styles.logEntryError,
                            log.level === "warning" && styles.logEntryWarning,
                          ]}
                        >
                          <Text style={styles.logTimestamp}>
                            {new Date(log.timestamp).toLocaleTimeString(
                              "de-DE",
                            )}
                          </Text>
                          <Text style={styles.logMessage} numberOfLines={3}>
                            {log.message}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  )}

                  {logs.length === 0 && !isLoadingLogs && !logsError && (
                    <Text style={styles.logsEmpty}>
                      Noch keine Logs verfügbar. Warte auf Build-Start...
                    </Text>
                  )}
                </>
              )}
            </View>
            {/* Links & Actions Card */}
            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>🔗 Links & Aktionen</Text>
              {details?.urls?.html ? (
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => openUrl(details.urls?.html)}
                >
                  <Text style={styles.linkButtonText}>
                    📱 GitHub Actions öffnen
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.infoText}>
                  GitHub-Link noch nicht verfügbar.
                </Text>
              )}

              {details?.urls?.artifacts ? (
                <TouchableOpacity
                  style={[styles.linkButton, styles.linkButtonSuccess]}
                  onPress={() => openUrl(details.urls?.artifacts)}
                >
                  <Text style={styles.linkButtonText}>
                    ⬇️ APK / Artefakte laden
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.infoText}>
                  Artefakte werden nach erfolgreichem Build angezeigt.
                </Text>
              )}
            </View>

            {lastError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>⚠️ Status-Fehler</Text>
                <Text style={styles.errorText}>{lastError}</Text>
              </View>
            )}
          </>
        )}

        {/* Build History Card */}
        <View style={styles.historyCard}>
          <View style={styles.cardHeader}>
            <View style={styles.historyTitleRow}>
              <Text style={styles.cardTitle}>📜 Build-Historie</Text>
              <View style={styles.statsRow}>
                <Text style={styles.statBadge}>✅ {stats.success}</Text>
                <Text
                  style={[styles.statBadge, { color: theme.palette.error }]}
                >
                  ❌ {stats.failed}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setShowHistory(!showHistory)}
              style={styles.toggleButton}
            >
              <Text style={styles.toggleButtonText}>
                {showHistory ? "▼ Ausblenden" : `▶ Anzeigen (${stats.total})`}
              </Text>
            </TouchableOpacity>
          </View>

          {showHistory && (
            <>
              {historyLoading ? (
                <View style={styles.logsLoading}>
                  <ActivityIndicator color={theme.palette.primary} />
                  <Text style={styles.logsLoadingText}>
                    Historie wird geladen...
                  </Text>
                </View>
              ) : history.length === 0 ? (
                <Text style={styles.historyEmpty}>
                  Noch keine Builds in der Historie. Starte oben einen Build!
                </Text>
              ) : (
                <>
                  <ScrollView
                    style={styles.historyScrollContainer}
                    contentContainerStyle={styles.historyContent}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                  >
                    {history.map((entry) => (
                      <TouchableOpacity
                        key={entry.id}
                        style={[
                          styles.historyEntry,
                          entry.jobId === jobId && styles.historyEntryCurrent,
                        ]}
                        onLongPress={() =>
                          handleDeleteHistoryEntry(entry.jobId)
                        }
                        activeOpacity={0.7}
                      >
                        <View style={styles.historyEntryHeader}>
                          <Text style={styles.historyEntryIcon}>
                            {getStatusIcon(entry.status)}
                          </Text>
                          <View style={styles.historyEntryInfo}>
                            <Text
                              style={styles.historyEntryRepo}
                              numberOfLines={1}
                            >
                              {entry.repoName}
                            </Text>
                            <Text style={styles.historyEntryMeta}>
                              Job #{entry.jobId} •{" "}
                              {formatHistoryDate(entry.startedAt)}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.historyEntryStatus,
                              { color: getStatusColor(entry.status) },
                            ]}
                          >
                            {entry.status.toUpperCase()}
                          </Text>
                        </View>

                        {entry.durationMs && (
                          <Text style={styles.historyEntryDuration}>
                            ⏱ Dauer: {formatDuration(entry.durationMs)}
                          </Text>
                        )}

                        {entry.artifactUrl && (
                          <TouchableOpacity
                            style={styles.historyArtifactButton}
                            onPress={() => openUrl(entry.artifactUrl)}
                          >
                            <Text style={styles.historyArtifactText}>
                              ⬇️ APK herunterladen
                            </Text>
                          </TouchableOpacity>
                        )}

                        {entry.errorMessage && (
                          <Text
                            style={styles.historyEntryError}
                            numberOfLines={2}
                          >
                            ⚠️ {entry.errorMessage}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {history.length > 0 && (
                    <TouchableOpacity
                      style={styles.clearHistoryButton}
                      onPress={handleClearHistory}
                    >
                      <Text style={styles.clearHistoryText}>
                        🗑️ Historie löschen
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
