import type { PreviewDisplayState, ResolvePreviewDisplayStateOptions } from "./types";

export function resolvePreviewDisplayState({
  phase,
  previewKind,
  previewSourceType,
  remoteUrlStatus,
  hasExpiredRemoteUrl,
  remoteFailure,
  stateError,
  webError,
  transientLocalPreviewNotice,
}: ResolvePreviewDisplayStateOptions): PreviewDisplayState {
  if (phase === "creating" || phase === "loading") {
    return {
      kind: "loading",
      tone: "warning",
      statusText: "Preview wird geladen…",
      detailText: remoteFailure,
      badgeText: "Lädt",
    };
  }

  const fatalError = webError ?? (phase === "error" ? stateError : null);
  if (fatalError) {
    return {
      kind: "failed",
      tone: "error",
      statusText: previewSourceType === "html" ? "Lokaler Fallback fehlgeschlagen" : "Preview fehlgeschlagen",
      detailText: fatalError,
      badgeText: "Fehler",
    };
  }

  if (previewSourceType === "url" && previewKind === "supabase" && remoteUrlStatus === "trusted") {
    return {
      kind: "remote_ready",
      tone: "ok",
      statusText: "Remote-Preview bereit",
      detailText: null,
      badgeText: "Server",
    };
  }

  if (previewSourceType === "html") {
    return {
      kind: "fallback_active",
      tone: "warning",
      statusText: "Lokaler Dev-Fallback aktiv",
      detailText:
        remoteFailure ??
        "Nur lokaler HTML-/Eval-Fallback; nicht server-verifiziert und nur Best-Effort.",
      badgeText: "Dev-Fallback",
    };
  }

  if (previewKind === "local" && transientLocalPreviewNotice) {
    return {
      kind: "unavailable",
      tone: "neutral",
      statusText: "Lokaler Dev-Fallback nicht verfügbar",
      detailText: transientLocalPreviewNotice,
      badgeText: "Nicht verfügbar",
    };
  }

  if (previewKind === "supabase") {
    if (hasExpiredRemoteUrl) {
      return {
        kind: "unavailable",
        tone: "neutral",
        statusText: "Remote-Preview abgelaufen",
        detailText: "Die gespeicherte Server-Preview ist nicht mehr gültig. Bitte neu erstellen.",
        badgeText: "Abgelaufen",
      };
    }

    if (remoteUrlStatus === "missing") {
      return {
        kind: "unavailable",
        tone: "neutral",
        statusText: "Remote-Preview nicht verfügbar",
        detailText: remoteFailure ?? "Es wurde keine verlässliche Preview-URL geliefert.",
        badgeText: "Nicht verfügbar",
      };
    }

    if (remoteUrlStatus === "invalid") {
      return {
        kind: "unavailable",
        tone: "neutral",
        statusText: "Remote-Preview blockiert",
        detailText: "Die gespeicherte Preview-URL ist ungültig.",
        badgeText: "Ungültig",
      };
    }

    if (remoteUrlStatus === "insecure") {
      return {
        kind: "unavailable",
        tone: "warning",
        statusText: "Remote-Preview blockiert",
        detailText: "Nur vertrauenswürdige HTTPS-Preview-Links werden geladen.",
        badgeText: "Unsicher",
      };
    }
  }

  if (remoteFailure) {
    return {
      kind: "unavailable",
      tone: "neutral",
      statusText: "Remote-Preview nicht verfügbar",
      detailText: remoteFailure,
      badgeText: "Nicht verfügbar",
    };
  }

  return {
    kind: "unavailable",
    tone: "neutral",
    statusText: "Keine Preview verfügbar",
    detailText: "Noch keine verlässliche Preview aktiv. Bitte neu erstellen.",
    badgeText: null,
  };
}
