import React, { useEffect, useMemo, useState, useCallback } from "react";
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
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBuildStatus, BuildStatus } from "../hooks/useBuildStatus";
import { useGitHubActionsLogs } from "../hooks/useGitHubActionsLogs";
import { BuildErrorAnalyzer, ErrorAnalysis } from "../lib/buildErrorAnalyzer";
import { CONFIG } from "../config";
import { theme } from "../theme";
import { useGitHub } from '../contexts/GitHubContext';

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

  const { status, details, lastError, isPolling } = useBuildStatus(jobId);
  
  const { 
    logs, 
    workflowRun, 
    isLoading: isLoadingLogs,
    error: logsError,
    refreshLogs 
  } = useGitHubActionsLogs({
    githubRepo: activeRepo,
    runId: details?.runId,
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
        setJobId(json.job.id);
        setStartedAt(Date.now());
        setElapsedMs(0);
        setShowLogs(true);
        setErrorAnalyses([]);
      } else {
        console.log("[EnhancedBuildScreen] Unexpected trigger response:", json);
        Alert.alert("Fehler", json?.error || "Fehler beim Start des Builds");
      }
    } catch (e: any) {
      console.log("[EnhancedBuildScreen] Build-Start-Error:", e);
      Alert.alert("Fehler", e?.message || "Build konnte nicht gestartet werden");
    }
  }, [activeRepo]);

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

  const openUrl = useCallback((url?: string | null) => {
    if (!url) {
      Alert.alert("Fehler", "Kein Link verfügbar");
      return;
    }
    Linking.openURL(url).catch((e) => {
      console.log("[EnhancedBuildScreen] Linking-Error:", e);
      Alert.alert("Fehler", "Link konnte nicht geöffnet werden");
    });
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshLogs();
    setRefreshing(false);
  }, [refreshLogs]);

  const progress = useMemo(() => STATUS_PROGRESS[status] ?? 0, [status]);
  const eta = useMemo(() => computeEta(status, elapsedMs), [status, elapsedMs]);
  const errorSummary = useMemo(() => 
    BuildErrorAnalyzer.generateSummary(errorAnalyses), 
    [errorAnalyses]
  );
  const criticalError = useMemo(() => 
    BuildErrorAnalyzer.getMostCriticalError(errorAnalyses),
    [errorAnalyses]
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.palette.primary}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>🚀 Live Build Status</Text>
          <Text style={styles.subtitle}>
            Starte einen Build und verfolge Warteschlange, Fortschritt und Dauer in Echtzeit.
          </Text>
        </View>

        {activeRepo && (
          <View style={styles.repoInfo}>
            <Text style={styles.repoLabel}>Aktives Repo:</Text>
            <Text style={styles.repoValue}>{activeRepo}</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={startBuild}
          style={[styles.buildButton, (isPolling || status === "building") && styles.buildButtonDisabled]}
          disabled={isPolling || status === "building"}
        >
          {isPolling || status === "building" ? (
            <ActivityIndicator color={theme.palette.secondary} />
          ) : (
            <Text style={styles.buildButtonText}>🚀 Build starten</Text>
          )}
        </TouchableOpacity>

        {!jobId && (
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
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${(progress * 100).toFixed(1)}%` },
                    status === 'failed' && styles.progressFillError,
                    status === 'success' && styles.progressFillSuccess,
                  ]} 
                />
              </View>

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
                    <View style={styles.logsContainer}>
                      {logs.slice(-30).map((log, idx) => (
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
                          <Text style={styles.logMessage}>{log.message}</Text>
                        </View>
                      ))}
                    </View>
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
  header: {
    padding: 16,
  },
  title: {
    color: theme.palette.primary,
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 6,
  },
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  repoInfo: {
    backgroundColor: theme.palette.card,
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  repoLabel: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginBottom: 4,
  },
  repoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.palette.primary,
  },
  buildButton: {
    backgroundColor: theme.palette.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 16,
  },
  buildButtonDisabled: {
    opacity: 0.7,
  },
  buildButtonText: {
    color: theme.palette.secondary,
    fontWeight: "bold",
    fontSize: 16,
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
    height: 8,
    borderRadius: 999,
    backgroundColor: theme.palette.background,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: theme.palette.primary,
    transition: 'width 0.3s ease',
  },
  progressFillError: {
    backgroundColor: theme.palette.error,
  },
  progressFillSuccess: {
    backgroundColor: theme.palette.success,
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
  logsContainer: {
    marginTop: 8,
    maxHeight: 400,
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
});
