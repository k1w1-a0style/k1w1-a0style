import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useBuildStatus, BuildStatus } from "../hooks/useBuildStatus";
import { CONFIG } from "../config";
import { theme } from "../theme";

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
  queued: "Projekt wartet in der Queue von Supabase / EAS.",
  building: "Expo/EAS packt gerade deine APK.",
  success: "Fertig! Artefakte stehen zum Download bereit.",
  failed: "Build fehlgeschlagen. Logs in GitHub Actions prüfen.",
  error: "Status konnte nicht aktualisiert werden.",
};

const TIMELINE_STEPS: {
  key: TimelineStepKey;
  label: string;
  description: string;
}[] = [
  {
    key: "queued",
    label: "Vorbereitung",
    description: "Job wird bei Supabase registriert & in die Warteschlange gestellt.",
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

export default function BuildScreen() {
  const [jobId, setJobId] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const { status, details, lastError, isPolling } = useBuildStatus(jobId);

  const startBuild = async () => {
    try {
      const res = await fetch(`${CONFIG.API.SUPABASE_EDGE_URL}/trigger-eas-build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubRepo: CONFIG.BUILD.GITHUB_REPO,
        }),
      });

      const json = await res.json();

      if (json.ok && json.job?.id) {
        setJobId(json.job.id);
        setStartedAt(Date.now());
        setElapsedMs(0);
      } else {
        console.log("[BuildScreen] Unexpected trigger response:", json);
        alert("Fehler beim Start des Builds");
      }
    } catch (e) {
      console.log("[BuildScreen] Build-Start-Error:", e);
      alert("Build konnte nicht gestartet werden");
    }
  };

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

  const openUrl = (url?: string | null) => {
    if (!url) return;
    Linking.openURL(url).catch((e) => {
      console.log("[BuildScreen] Linking-Error:", e);
      alert("Link konnte nicht geöffnet werden");
    });
  };

  const progress = useMemo(() => STATUS_PROGRESS[status] ?? 0, [status]);
  const eta = useMemo(() => computeEta(status, elapsedMs), [status, elapsedMs]);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>📦 Live Build Status</Text>
      <Text style={styles.subtitle}>
        Starte einen Build und verfolge Warteschlange, Fortschritt und Dauer in Echtzeit.
      </Text>

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
        <Text style={styles.hintText}>
          Noch kein Build aktiv. Starte oben einen Run, um Live-Daten zu sehen.
        </Text>
      )}

      {jobId && (
        <>
          <View style={styles.liveCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Live-Status</Text>
              <Text style={styles.cardMeta}>Job #{jobId}</Text>
            </View>

            <Text style={styles.statusText}>{STATUS_MESSAGES[status]}</Text>

            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(progress * 100).toFixed(1)}%` }]} />
            </View>

            <View style={styles.liveMetrics}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Verstrichene Zeit</Text>
                <Text style={styles.metricValue}>{formatDuration(elapsedMs)}</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Geschätzte Restzeit</Text>
                <Text style={styles.metricValue}>
                  {status === "success" ? "0:00 min" : formatDuration(eta)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.timelineCard}>
            <Text style={styles.cardTitle}>Ablauf</Text>
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

          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>Links & Aktionen</Text>
            {details?.urls?.html ? (
              <TouchableOpacity style={styles.linkButton} onPress={() => openUrl(details.urls?.html)}>
                <Text style={styles.linkButtonText}>🔗 GitHub Actions öffnen</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.infoText}>GitHub-Link noch nicht verfügbar.</Text>
            )}

            {details?.urls?.artifacts ? (
              <TouchableOpacity
                style={[styles.linkButton, styles.linkButtonSecondary]}
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
              <Text style={styles.errorTitle}>Status-Fehler</Text>
              <Text style={styles.errorText}>{lastError}</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.palette.background,
    padding: (theme as any).layout?.screenPadding ?? 16,
  },
  title: {
    color: theme.palette.text.primary,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    color: theme.palette.text.secondary,
    marginBottom: 16,
  },
  buildButton: {
    backgroundColor: theme.palette.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  buildButtonDisabled: {
    opacity: 0.7,
  },
  buildButtonText: {
    color: theme.palette.secondary,
    fontWeight: "bold",
  },
  hintText: {
    color: theme.palette.text.secondary,
    marginTop: 4,
  },
  liveCard: {
    marginTop: 12,
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
    marginBottom: 8,
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
  },
  progressFill: {
    height: "100%",
    backgroundColor: theme.palette.primary,
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
    color: theme.palette.text.primary,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 4,
  },
  timelineCard: {
    marginTop: 16,
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
  infoCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  linkButton: {
    marginTop: 8,
    backgroundColor: theme.palette.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  linkButtonSecondary: {
    backgroundColor: theme.palette.secondary,
  },
  linkButtonText: {
    color: theme.palette.text.primary,
    fontWeight: "600",
  },
  infoText: {
    color: theme.palette.text.secondary,
    marginTop: 6,
  },
  errorBox: {
    marginTop: 16,
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
