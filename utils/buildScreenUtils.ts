/**
 * Build Screen Utils
 * Pure helper functions, types and constants for EnhancedBuildScreen
 */

import type { BuildStatus } from "../shared/types/build";
import { theme } from "../theme";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type TimelineStepKey = "queued" | "building" | "success";
export type TimelineStepState = "done" | "current" | "upcoming" | "failed";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

export const EST_QUEUE_MS = 45_000;
export const EST_BUILD_MS = 150_000;

export const STATUS_PROGRESS: Record<BuildStatus, number> = {
  idle: 0,
  queued: 0.25,
  building: 0.6,
  success: 1,
  failed: 1,
  error: 1,
};

export const STATUS_MESSAGES: Record<BuildStatus, string> = {
  idle: "Noch kein Build gestartet.",
  queued: "⏳ Projekt wartet in der Queue von GitHub Actions / EAS.",
  building: "🔨 Expo/EAS packt gerade deine APK.",
  success: "✅ Fertig! Artefakte stehen zum Download bereit.",
  failed: "❌ Build fehlgeschlagen. Siehe Fehleranalyse unten.",
  error: "⚠️ Status konnte nicht aktualisiert werden.",
};

export const TIMELINE_STEPS: {
  key: TimelineStepKey;
  label: string;
  description: string;
}[] = [
  {
    key: "queued",
    label: "Vorbereitung",
    description:
      "Job wird bei GitHub Actions registriert & in die Warteschlange gestellt.",
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

// ─────────────────────────────────────────────────────────────
// Pure Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Formatiert Millisekunden zu lesbarem Zeitformat (z.B. "2:45 min")
 */
export const formatDuration = (ms: number): string => {
  if (ms <= 0) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")} min`;
};

/**
 * Berechnet die geschätzte Restzeit basierend auf Status und verstrichener Zeit
 */
export const computeEta = (status: BuildStatus, elapsedMs: number): number => {
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

/**
 * Ermittelt den Zustand eines Timeline-Schritts basierend auf Build-Status
 */
export const getStepState = (
  status: BuildStatus,
  step: TimelineStepKey,
): TimelineStepState => {
  const order: TimelineStepKey[] = ["queued", "building", "success"];
  const stepIndex = order.indexOf(step);

  // Idle: alles ist "upcoming"
  if (status === "idle") {
    return "upcoming";
  }

  // Failed/Error: queued war done, building ist failed, success ist upcoming
  if (status === "failed" || status === "error") {
    if (step === "queued") return "done";
    if (step === "building") return "failed";
    return "upcoming";
  }

  // Success: alle Schritte sind done
  if (status === "success") {
    return "done";
  }

  // Queued oder Building: basierend auf Position in der Timeline
  const statusIndex = order.indexOf(status as TimelineStepKey);

  if (statusIndex > stepIndex) return "done";
  if (statusIndex === stepIndex) return "current";
  return "upcoming";
};

/**
 * Gibt die Farbe für eine Fehler-Schwere zurück
 */
export const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case "critical":
      return theme.palette.error;
    case "high":
      return "#ff6b6b";
    case "medium":
      return theme.palette.warning;
    case "low":
      return "#ffd93d";
    default:
      return theme.palette.text.secondary;
  }
};

/**
 * Formatiert ein Datum relativ zur aktuellen Zeit (z.B. "vor 5 Min.")
 * Robuste Version mit Fallback bei ungültigen Dates.
 */
export const formatRelativeTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) return "gerade eben";
    if (diffMinutes < 60) return `vor ${diffMinutes} Min.`;
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
};


/**
 * Gibt das passende Emoji für einen Build-Status zurück
 */
export const getStatusIcon = (historyStatus: string): string => {
  switch (historyStatus) {
    case "success":
      return "✅";
    case "failed":
    case "error":
      return "❌";
    case "building":
      return "🔨";
    case "queued":
      return "⏳";
    default:
      return "❓";
  }
};

/**
 * Gibt die Theme-Farbe für einen Build-Status zurück
 */
export const getStatusColor = (historyStatus: string): string => {
  switch (historyStatus) {
    case "success":
      return theme.palette.success;
    case "failed":
    case "error":
      return theme.palette.error;
    case "building":
      return theme.palette.primary;
    case "queued":
      return theme.palette.warning;
    default:
      return theme.palette.text.secondary;
  }
};

/**
 * Gibt Farbe für GitHub Actions Workflow-Status zurück
 * (unterscheidet sich von getStatusColor, da GitHub eigene Status-Strings verwendet)
 */
export const getWorkflowStatusColor = (
  status: string,
  conclusion: string | null,
): string => {
  if (status === "completed") {
    switch (conclusion) {
      case "success":
        return theme.palette.success;
      case "failure":
        return theme.palette.error;
      case "cancelled":
        return "#888888";
      default:
        return theme.palette.warning;
    }
  }
  if (status === "in_progress" || status === "queued")
    return theme.palette.info;
  return theme.palette.text.secondary;
};

/**
 * Gibt lesbaren Text für GitHub Actions Status zurück
 */
export const getWorkflowStatusText = (
  status: string,
  conclusion: string | null,
): string => {
  if (status === "completed") return conclusion || "completed";
  return status;
};
