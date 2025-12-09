import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  ScrollView,
  RefreshControl,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBuildStatus } from "../hooks/useBuildStatus";
import { useBuildHistory } from "../hooks/useBuildHistory";
import { BuildStatus } from "../lib/buildStatusMapper";
import { useGitHubActionsLogs } from "../hooks/useGitHubActionsLogs";
import { BuildErrorAnalyzer, ErrorAnalysis } from "../lib/buildErrorAnalyzer";
import { CONFIG } from "../config";
import { theme, getNeonGlow } from "../theme";
import { useGitHub } from '../contexts/GitHubContext';
import { BuildHistoryEntry } from "../contexts/types";
import { useNotifications } from "../hooks/useNotifications";

type TimelineStepKey = "queued" | "building" | "success";
type TimelineStepState = "done" | "current" | "upcoming" | "failed";

const EST_QUEUE_MS = 45_000;
const EST_BUILD_MS = 150_000;
const STATUS_PROGRESS: Record<BuildStatus, number> = {
  idle: 0,
  queued: 0.25,
  building: 0.6,
  success: 1,
  failed: 1,
  error: 1,
};

const STATUS_MESSAGES: Record<BuildStatus, string> = {
  idle: "Noch kein Build gestartet.",
  queued: "⏳ Projekt wartet in der Queue von GitHub Actions / EAS.",
  building: "🔨 Expo/EAS packt gerade deine APK.",
  success: "✅ Fertig! Artefakte stehen zum Download bereit.",
  failed: "❌ Build fehlgeschlagen. Siehe Fehleranalyse unten.",
  error: "⚠️ Status konnte nicht aktualisiert werden.",
};

const TIMELINE_STEPS: {
  key: TimelineStepKey;
  label: string;
  description: string;
}[] = [
  {
    key: "queued",
    label: "Vorbereitung",
    description: "Job wird bei GitHub Actions registriert & in die Warteschlange gestellt.",
  },
  {
    key: "building",
    label: "Build läuft",
    description: "EAS erstellt das Android-Paket und lädt Assets hoch.",
  },
  {
    key: "success",
    label: "APK bereit",
    description: "Download-Link verfügbar & Installation möglich.",
  },
];

const formatDuration = (ms: number): string => {
  if (ms <= 0) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")} min`;
};

const computeEta = (status: BuildStatus, elapsedMs: number): number => {
  const elapsedBeyondQueue = Math.max(elapsedMs - EST_QUEUE_MS, 0);
  if (status === "success") return 0;
  if (status === "failed" || status === "error") return 0;
  if (status === "queued") {
    const total = EST_QUEUE_MS + EST_BUILD_MS;
    return Math.max(total - elapsedMs, 0);
  }
  if (status === "building") {
    return Math.max(EST_BUILD_MS - elapsedBeyondQueue, 0);
  }
  return EST_QUEUE_MS + EST_BUILD_MS;
};

const getStepState = (status: BuildStatus, step: TimelineStepKey): TimelineStepState => {
  const order: TimelineStepKey[] = ["queued", "building", "success"];
  const statusOrder: TimelineStepKey | "failed" | "error" | "idle" = status;
  if (status === "failed" || status === "error") {
    if (step === "queued") return "done";
    if (step === "building") return "failed";
    return "upcoming";
  }
  const statusIndex = order.indexOf(statusOrder as TimelineStepKey);
  const stepIndex = order.indexOf(step);

  if (status === "success") {
    if (step === "success") return "done";
  }

  if (statusIndex > stepIndex) return "done";
  if (statusIndex === stepIndex) {
    return status === "idle" ? "upcoming" : "current";
  }
  return "upcoming";
};

const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case 'critical':
      return theme.palette.error;
    case 'high':
      return '#ff6b6b';
    case 'medium':
      return theme.palette.warning;
    case 'low':
      return '#ffd93d';
    default:
      return theme.palette.text.secondary;
  }
};

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
    isLoading: historyLoading 
  } = useBuildHistory();

  // Notifications Hook
  const { notifyBuildSuccess, notifyBuildFailure, notifyBuildStarted } = useNotifications();

  const { status, details, lastError, isPolling } = useBuildStatus(jobId);
  
  // Extract runId from raw response if available
  const runId = details?.raw?.runId || details?.raw?.run_id || null;
  
  const { 
    logs, 
    workflowRun, 
    isLoading: isLoadingLogs,
    error: logsError,
    refreshLogs 
  } = useGitHubActionsLogs({
    githubRepo: activeRepo,
    runId: runId,
    autoRefresh: status === 'building' || status === 'queued',
  });

  // Analyze errors when logs update
  useEffect(() => {
    if (logs.length > 0 && (status === 'failed' || status === 'error')) {
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
    if (status === 'building' || status === 'queued') {
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
        ])
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

  const startBuild = useCallback(async () => {
    if (!activeRepo) {
      Alert.alert(
        'Kein Repo ausgewählt',
        'Bitte wähle zuerst ein GitHub-Repo im „GitHub Repos"-Screen aus.'
      );
      return;
    }
    
    try {
      const res = await fetch(`${CONFIG.API.SUPABASE_EDGE_URL}/trigger-eas-build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubRepo: activeRepo,
          buildProfile: 'preview',
          buildType: 'normal',
        }),
      });

      const json = await res.json();

      if (json.ok && json.job?.id) {
        const newJobId = json.job.id;
        setJobId(newJobId);
        setStartedAt(Date.now());
        setElapsedMs(0);
        setShowLogs(true);
        setErrorAnalyses([]);
        
        // ✅ Build zur Historie hinzufügen
        await addToHistory(newJobId, activeRepo, 'preview');
        
        // 📱 Notification senden
        await notifyBuildStarted(String(newJobId), 'Android');
      } else {
        Alert.alert("Fehler", json?.error || "Fehler beim Start des Builds");
      }
    } catch (e: any) {
      Alert.alert("Fehler", e?.message || "Build konnte nicht gestartet werden");
    }
  }, [activeRepo, addToHistory]);

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
    if (jobId && ['success', 'failed', 'error'].includes(status)) {
      updateHistory(jobId, status as 'success' | 'failed' | 'error', {
        artifactUrl: details?.urls?.artifacts,
        htmlUrl: details?.urls?.html,
        errorMessage: lastError || undefined,
      });
      
      // 📱 Notifications senden
      if (status === 'success') {
        notifyBuildSuccess(String(jobId), 'Android');
      } else if (status === 'failed' || status === 'error') {
        notifyBuildFailure(String(jobId), lastError || 'Unbekannter Fehler', 'Android');
      }
    }
  }, [jobId, status, details, lastError, updateHistory, notifyBuildSuccess, notifyBuildFailure]);

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
      '🔄 Build zurücksetzen?',
      'Möchtest du den aktuellen Build-Status zurücksetzen und einen neuen Build starten?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Zurücksetzen',
          style: 'destructive',
          onPress: () => {
            setJobId(null);
            setStartedAt(null);
            setElapsedMs(0);
            setShowLogs(false);
            setErrorAnalyses([]);
          },
        },
      ]
    );
  }, []);

  const eta = useMemo(() => computeEta(status, elapsedMs), [status, elapsedMs]);
  const errorSummary = useMemo(() => 
    BuildErrorAnalyzer.generateSummary(errorAnalyses), 
    [errorAnalyses]
  );
  const criticalError = useMemo(() => 
    BuildErrorAnalyzer.getMostCriticalError(errorAnalyses),
    [errorAnalyses]
  );
  
  // Width interpolation for animated progress bar
  const animatedWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // ✅ NEU: Helper für Build-Historie Zeitformatierung
  const formatHistoryDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return 'gerade eben';
    if (diffMinutes < 60) return `vor ${diffMinutes} Min.`;
    if (diffHours < 24) return `vor ${diffHours} Std.`;
    if (diffDays < 7) return `vor ${diffDays} Tagen`;
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const getStatusIcon = (historyStatus: string): string => {
    switch (historyStatus) {
      case 'success': return '✅';
      case 'failed': 
      case 'error': return '❌';
      case 'building': return '🔨';
      case 'queued': return '⏳';
      default: return '❓';
    }
  };

  const getStatusColor = (historyStatus: string): string => {
    switch (historyStatus) {
      case 'success': return theme.palette.success;
      case 'failed': 
      case 'error': return theme.palette.error;
      case 'building': return theme.palette.primary;
      case 'queued': return theme.palette.warning;
      default: return theme.palette.text.secondary;
    }
  };

  const handleDeleteHistoryEntry = useCallback((jobIdToDelete: number) => {
    Alert.alert(
      'Eintrag löschen?',
      `Möchtest du Build #${jobIdToDelete} aus der Historie entfernen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => deleteFromHistory(jobIdToDelete),
        },
      ]
    );
  }, [deleteFromHistory]);

  const handleClearHistory = useCallback(() => {
    Alert.alert(
      'Historie löschen?',
      'Möchtest du die gesamte Build-Historie unwiderruflich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Alles löschen',
          style: 'destructive',
          onPress: clearHistory,
        },
      ]
    );
  }, [clearHistory]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
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
            Starte einen Build und verfolge Warteschlange, Fortschritt und Dauer in Echtzeit.
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
              Wähle zuerst ein GitHub-Repo im „GitHub Repos"-Tab aus, bevor du einen Build starten kannst.
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={startBuild}
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
                <ActivityIndicator color={theme.palette.secondary} size="small" />
                <Text style={styles.buildButtonTextActive}>Build läuft...</Text>
              </View>
            ) : (
              <Text style={styles.buildButtonText}>🚀 Build starten</Text>
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
              💡 Noch kein Build aktiv. Starte oben einen Run, um Live-Daten zu sehen.
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
                    status === 'failed' && styles.progressFillError,
                    status === 'success' && styles.progressFillSuccess,
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
                  <Text style={styles.metricValue}>{formatDuration(elapsedMs)}</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>⏳ Geschätzte Restzeit</Text>
                  <Text style={styles.metricValue}>
                    {status === "success" ? "0:00 min" : formatDuration(eta)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Timeline Card */}
            <View style={styles.timelineCard}>
              <Text style={styles.cardTitle}>📋 Ablauf</Text>
              {TIMELINE_STEPS.map((step, index) => {
                const state = getStepState(status, step.key);
                return (
                  <View key={step.key} style={styles.timelineRow}>
                    <View style={styles.timelineIconWrapper}>
                      <View
                        style={[
                          styles.timelineIcon,
                          state === "done" && styles.timelineIconDone,
                          state === "current" && styles.timelineIconCurrent,
                          state === "failed" && styles.timelineIconFailed,
                        ]}
                      >
                        {state === "done" && <Text style={styles.timelineIconText}>✓</Text>}
                        {state === "current" && <Text style={styles.timelineIconText}>•</Text>}
                        {state === "failed" && <Text style={styles.timelineIconText}>!</Text>}
                      </View>
                      {index !== TIMELINE_STEPS.length - 1 && <View style={styles.timelineConnector} />}
                    </View>

                    <View style={styles.timelineTextWrapper}>
                      <Text style={styles.timelineLabel}>{step.label}</Text>
                      <Text style={styles.timelineDescription}>{step.description}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Error Analysis Card */}
            {(status === 'failed' || status === 'error') && errorAnalyses.length > 0 && (
              <View style={styles.errorAnalysisCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>🔍 Fehleranalyse</Text>
                  <Text style={[styles.cardMeta, { color: theme.palette.error }]}>
                    {errorSummary}
                  </Text>
                </View>

                {criticalError && (
                  <View style={[styles.errorItem, styles.errorItemCritical]}>
                    <View style={styles.errorItemHeader}>
                      <Text style={[styles.errorCategory, { color: getSeverityColor(criticalError.severity) }]}>
                        {criticalError.category}
                      </Text>
                      <Text style={[styles.errorSeverity, { color: getSeverityColor(criticalError.severity) }]}>
                        {criticalError.severity.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.errorDescription}>{criticalError.description}</Text>
                    <View style={styles.errorSuggestionBox}>
                      <Text style={styles.errorSuggestionLabel}>💡 Lösung:</Text>
                      <Text style={styles.errorSuggestion}>{criticalError.suggestion}</Text>
                    </View>
                    {criticalError.documentation && (
                      <TouchableOpacity
                        style={styles.docsButton}
                        onPress={() => openUrl(criticalError.documentation)}
                      >
                        <Text style={styles.docsButtonText}>📖 Dokumentation öffnen</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {errorAnalyses.slice(1).map((error, idx) => (
                  <View key={idx} style={styles.errorItem}>
                    <View style={styles.errorItemHeader}>
                      <Text style={[styles.errorCategory, { color: getSeverityColor(error.severity) }]}>
                        {error.category}
                      </Text>
                      <Text style={[styles.errorSeverity, { color: getSeverityColor(error.severity) }]}>
                        {error.severity}
                      </Text>
                    </View>
                    <Text style={styles.errorDescription}>{error.description}</Text>
                    <Text style={styles.errorSuggestion}>💡 {error.suggestion}</Text>
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
                    {showLogs ? '▼ Ausblenden' : '▶ Anzeigen'}
                  </Text>
                </TouchableOpacity>
              </View>

              {showLogs && (
                <>
                  {isLoadingLogs && (
                    <View style={styles.logsLoading}>
                      <ActivityIndicator color={theme.palette.primary} />
                      <Text style={styles.logsLoadingText}>Logs werden geladen...</Text>
                    </View>
                  )}

                  {logsError && (
                    <Text style={styles.logsError}>
                      ⚠️ {logsError}
                    </Text>
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
                            log.level === 'error' && styles.logEntryError,
                            log.level === 'warning' && styles.logEntryWarning,
                          ]}
                        >
                          <Text style={styles.logTimestamp}>
                            {new Date(log.timestamp).toLocaleTimeString('de-DE')}
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
                <TouchableOpacity style={styles.linkButton} onPress={() => openUrl(details.urls?.html)}>
                  <Text style={styles.linkButtonText}>📱 GitHub Actions öffnen</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.infoText}>GitHub-Link noch nicht verfügbar.</Text>
              )}

              {details?.urls?.artifacts ? (
                <TouchableOpacity
                  style={[styles.linkButton, styles.linkButtonSuccess]}
                  onPress={() => openUrl(details.urls?.artifacts)}
                >
                  <Text style={styles.linkButtonText}>⬇️ APK / Artefakte laden</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.infoText}>Artefakte werden nach erfolgreichem Build angezeigt.</Text>
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

        {/* ✅ NEU: Build History Card */}
        <View style={styles.historyCard}>
          <View style={styles.cardHeader}>
            <View style={styles.historyTitleRow}>
              <Text style={styles.cardTitle}>📜 Build-Historie</Text>
              <View style={styles.statsRow}>
                <Text style={styles.statBadge}>
                  ✅ {stats.success}
                </Text>
                <Text style={[styles.statBadge, { color: theme.palette.error }]}>
                  ❌ {stats.failed}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setShowHistory(!showHistory)}
              style={styles.toggleButton}
            >
              <Text style={styles.toggleButtonText}>
                {showHistory ? '▼ Ausblenden' : `▶ Anzeigen (${stats.total})`}
              </Text>
            </TouchableOpacity>
          </View>

          {showHistory && (
            <>
              {historyLoading ? (
                <View style={styles.logsLoading}>
                  <ActivityIndicator color={theme.palette.primary} />
                  <Text style={styles.logsLoadingText}>Historie wird geladen...</Text>
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
                        onLongPress={() => handleDeleteHistoryEntry(entry.jobId)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.historyEntryHeader}>
                          <Text style={styles.historyEntryIcon}>
                            {getStatusIcon(entry.status)}
                          </Text>
                          <View style={styles.historyEntryInfo}>
                            <Text style={styles.historyEntryRepo} numberOfLines={1}>
                              {entry.repoName}
                            </Text>
                            <Text style={styles.historyEntryMeta}>
                              Job #{entry.jobId} • {formatHistoryDate(entry.startedAt)}
                            </Text>
                          </View>
                          <Text style={[styles.historyEntryStatus, { color: getStatusColor(entry.status) }]}>
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
                            <Text style={styles.historyArtifactText}>⬇️ APK herunterladen</Text>
                          </TouchableOpacity>
                        )}
                        
                        {entry.errorMessage && (
                          <Text style={styles.historyEntryError} numberOfLines={2}>
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
                      <Text style={styles.clearHistoryText}>🗑️ Historie löschen</Text>
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    padding: 16,
    alignItems: 'center',
  },
  title: {
    color: theme.palette.primary,
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: 'center',
    ...getNeonGlow(theme.palette.primary, 'subtle'),
  },
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  repoInfo: {
    backgroundColor: theme.palette.card,
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.palette.primary + '40',
  },
  repoLabel: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginBottom: 6,
  },
  repoValue: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.palette.primary,
  },
  noRepoCard: {
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: theme.palette.warning,
    alignItems: 'center',
  },
  noRepoIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  noRepoTitle: {
    color: theme.palette.warning,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  noRepoText: {
    color: theme.palette.text.secondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  buildButton: {
    flex: 1,
    backgroundColor: theme.palette.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: 'center',
    ...getNeonGlow(theme.palette.primary, 'normal'),
  },
  buildButtonActive: {
    backgroundColor: theme.palette.primaryDark,
    opacity: 1,
  },
  buildButtonDisabled: {
    opacity: 0.5,
    ...getNeonGlow(theme.palette.primary, 'subtle'),
  },
  buildButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buildButtonText: {
    color: theme.palette.secondary,
    fontWeight: "bold",
    fontSize: 16,
  },
  buildButtonTextActive: {
    color: theme.palette.secondary,
    fontWeight: "600",
    fontSize: 14,
  },
  resetButton: {
    backgroundColor: theme.palette.card,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  resetButtonText: {
    fontSize: 20,
  },
  hintCard: {
    backgroundColor: theme.palette.card,
    borderRadius: 10,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  hintText: {
    color: theme.palette.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  liveCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: {
    color: theme.palette.text.primary,
    fontSize: 16,
    fontWeight: "600",
  },
  cardMeta: {
    color: theme.palette.text.secondary,
    fontSize: 13,
  },
  statusText: {
    color: theme.palette.text.primary,
    fontSize: 14,
    marginBottom: 12,
  },
  progressBar: {
    height: 10,
    borderRadius: 999,
    backgroundColor: theme.palette.background,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  progressFill: {
    height: "100%",
    backgroundColor: theme.palette.primary,
    borderRadius: 999,
  },
  progressFillError: {
    backgroundColor: theme.palette.error,
  },
  progressFillSuccess: {
    backgroundColor: theme.palette.success,
  },
  progressPercent: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  liveMetrics: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  metricBox: {
    flex: 1,
  },
  metricLabel: {
    color: theme.palette.text.secondary,
    fontSize: 12,
  },
  metricValue: {
    color: theme.palette.primary,
    fontSize: 18,
    fontWeight: "600",
    marginTop: 4,
  },
  timelineCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  timelineRow: {
    flexDirection: "row",
    marginTop: 12,
  },
  timelineIconWrapper: {
    width: 30,
    alignItems: "center",
  },
  timelineIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineIconDone: {
    borderColor: theme.palette.success,
    backgroundColor: theme.palette.success + "30",
  },
  timelineIconCurrent: {
    borderColor: theme.palette.primary,
    backgroundColor: theme.palette.primary + "25",
  },
  timelineIconFailed: {
    borderColor: theme.palette.error,
    backgroundColor: theme.palette.error + "20",
  },
  timelineIconText: {
    color: theme.palette.text.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  timelineConnector: {
    flex: 1,
    width: 2,
    backgroundColor: theme.palette.border,
    marginTop: 2,
  },
  timelineTextWrapper: {
    flex: 1,
    paddingLeft: 12,
  },
  timelineLabel: {
    color: theme.palette.text.primary,
    fontWeight: "600",
  },
  timelineDescription: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginTop: 2,
  },
  errorAnalysisCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.palette.card,
    borderWidth: 2,
    borderColor: theme.palette.error,
  },
  errorItem: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: theme.palette.background,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  errorItemCritical: {
    borderColor: theme.palette.error,
    borderWidth: 2,
  },
  errorItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  errorCategory: {
    fontSize: 14,
    fontWeight: "600",
  },
  errorSeverity: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  errorDescription: {
    color: theme.palette.text.primary,
    fontSize: 13,
    marginBottom: 8,
  },
  errorSuggestionBox: {
    backgroundColor: theme.palette.background,
    padding: 10,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: theme.palette.primary,
  },
  errorSuggestionLabel: {
    color: theme.palette.primary,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  errorSuggestion: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    lineHeight: 18,
  },
  docsButton: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: theme.palette.primary + "20",
    borderWidth: 1,
    borderColor: theme.palette.primary,
  },
  docsButtonText: {
    color: theme.palette.primary,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  logsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: theme.palette.background,
  },
  toggleButtonText: {
    color: theme.palette.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  logsLoading: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  logsLoadingText: {
    color: theme.palette.text.secondary,
    marginLeft: 8,
  },
  logsError: {
    color: theme.palette.error,
    padding: 12,
  },
  logsEmpty: {
    color: theme.palette.text.secondary,
    padding: 12,
    textAlign: "center",
  },
  logsScrollContainer: {
    marginTop: 8,
    maxHeight: 300,
    borderRadius: 8,
    backgroundColor: theme.palette.background,
  },
  logsContent: {
    paddingVertical: 4,
  },
  logEntry: {
    flexDirection: "row",
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  logEntryError: {
    backgroundColor: theme.palette.error + "15",
    borderLeftWidth: 3,
    borderLeftColor: theme.palette.error,
  },
  logEntryWarning: {
    backgroundColor: theme.palette.warning + "15",
    borderLeftWidth: 3,
    borderLeftColor: theme.palette.warning,
  },
  logTimestamp: {
    color: theme.palette.text.secondary,
    fontSize: 11,
    fontFamily: "monospace",
    marginRight: 8,
    minWidth: 70,
  },
  logMessage: {
    color: theme.palette.text.primary,
    fontSize: 12,
    fontFamily: "monospace",
    flex: 1,
  },
  infoCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  linkButton: {
    marginTop: 8,
    backgroundColor: theme.palette.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  linkButtonSuccess: {
    backgroundColor: theme.palette.success,
  },
  linkButtonText: {
    color: theme.palette.secondary,
    fontWeight: "600",
  },
  infoText: {
    color: theme.palette.text.secondary,
    marginTop: 6,
    fontSize: 13,
  },
  errorBox: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 10,
    backgroundColor: theme.palette.error + "11",
    borderWidth: 1,
    borderColor: theme.palette.error,
  },
  errorTitle: {
    color: theme.palette.error,
    fontWeight: "600",
    marginBottom: 4,
  },
  errorText: {
    color: theme.palette.text.primary,
    fontSize: 13,
  },
  // ✅ NEU: Build History Styles
  historyCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.palette.success,
  },
  historyEmpty: {
    color: theme.palette.text.secondary,
    padding: 12,
    textAlign: 'center',
  },
  historyScrollContainer: {
    marginTop: 12,
    maxHeight: 350,
    borderRadius: 8,
    backgroundColor: theme.palette.background,
  },
  historyContent: {
    paddingVertical: 4,
  },
  historyEntry: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  historyEntryCurrent: {
    backgroundColor: theme.palette.primary + '15',
    borderLeftWidth: 3,
    borderLeftColor: theme.palette.primary,
  },
  historyEntryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyEntryIcon: {
    fontSize: 18,
  },
  historyEntryInfo: {
    flex: 1,
  },
  historyEntryRepo: {
    color: theme.palette.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  historyEntryMeta: {
    color: theme.palette.text.secondary,
    fontSize: 11,
    marginTop: 2,
  },
  historyEntryStatus: {
    fontSize: 10,
    fontWeight: '700',
  },
  historyEntryDuration: {
    color: theme.palette.text.secondary,
    fontSize: 11,
    marginTop: 6,
    marginLeft: 28,
  },
  historyArtifactButton: {
    marginTop: 8,
    marginLeft: 28,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: theme.palette.success + '20',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  historyArtifactText: {
    color: theme.palette.success,
    fontSize: 12,
    fontWeight: '600',
  },
  historyEntryError: {
    color: theme.palette.error,
    fontSize: 11,
    marginTop: 6,
    marginLeft: 28,
  },
  clearHistoryButton: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: theme.palette.error + '15',
    borderWidth: 1,
    borderColor: theme.palette.error + '40',
    alignItems: 'center',
  },
  clearHistoryText: {
    color: theme.palette.error,
    fontSize: 13,
    fontWeight: '600',
  },
});
