// hooks/previewHelpers.ts
// Shared preview helper utilities to keep usePreview/usePreviewScreen aligned.

export type ProjectFile = { path?: string; content?: string };

export interface PreviewState {
  isCreating: boolean;
  lastCreatedAt: number | null;
  error: string | null;
  remoteFailure: string | null;
  fileCount: number;
  totalSize: number;
  skippedCount: number;
}

export type PreviewResult = {
  url: string | null;
  html: string | null;
  expiresAt: string | null;
  source: "supabase" | "local";
};

export type PreviewAttemptMode = "supabase" | "local" | null | undefined;
export type PreviewPhase = "idle" | "creating" | "loading" | "ready" | "error";
export type PreviewRemoteUrlStatus =
  | "missing"
  | "invalid"
  | "insecure"
  | "trusted";
export type PreviewDisplayKind =
  | "loading"
  | "remote_ready"
  | "fallback_active"
  | "unavailable"
  | "failed";

export interface PreviewDisplayState {
  kind: PreviewDisplayKind;
  tone: "neutral" | "ok" | "warning" | "error";
  statusText: string;
  detailText: string | null;
  badgeText: string | null;
}

export const ALLOWED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".html",
  ".htm",
  ".md",
  ".mdx",
  ".txt",
  ".svg",
  ".graphql",
  ".gql",
]);

export const IGNORED_PATTERNS = [
  "node_modules/",
  ".expo/",
  ".git/",
  ".next/",
  "dist/",
  "build/",
  ".cache/",
  "__tests__/",
  "__mocks__/",
];

export function promiseWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });
  return (Promise.race([promise, timeoutPromise]) as Promise<T>).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

export function isProjectFile(value: unknown): value is ProjectFile {
  if (!value || typeof value !== "object") return false;
  const candidate = value as ProjectFile;
  return typeof candidate.path === "string" && typeof candidate.content === "string";
}

export function sanitizePreviewPath(raw: string): string | null {
  let p = String(raw ?? "")
    .trim()
    .replace(/\\/g, "/");
  if (!p) return null;
  if (p.length > 300) return null;
  if (p.includes("\0")) return null;

  const segs = p.split("/").filter(Boolean);
  if (segs.some((s) => s === "..")) return null;

  p = p.replace(/\/+/g, "/");
  if (!p.startsWith("/")) p = "/" + p;
  return p;
}

export function isAllowedFile(path: string): boolean {
  const p = path.toLowerCase();
  if (IGNORED_PATTERNS.some((pattern) => p.includes(pattern))) return false;
  const ext = p.match(/\.[^./]+$/)?.[0];
  if (!ext) return false;
  return ALLOWED_EXTENSIONS.has(ext);
}

export function safeJson<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

/** Simple DJB2 string hash for fingerprinting. */
export function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

export function shouldAttemptSupabaseFirst(mode: PreviewAttemptMode): boolean {
  return mode !== "local";
}

function isTrustedLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function getPreviewRemoteUrlStatus(url: string | null | undefined): PreviewRemoteUrlStatus {
  const raw = String(url ?? "").trim();
  if (!raw) return "missing";

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return "invalid";
  }

  if (parsed.protocol === "https:") return "trusted";
  if (parsed.protocol === "http:" && isTrustedLoopbackHost(parsed.hostname)) return "trusted";
  if (parsed.protocol === "http:") return "insecure";
  return "invalid";
}

export function describeRemotePreviewFailure(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const normalized = message.toLowerCase();

  if (
    normalized.includes("timeout") ||
    normalized.includes("network request failed") ||
    normalized.includes("fetch failed") ||
    normalized.includes("not reachable")
  ) {
    return "Preview-Server derzeit nicht erreichbar.";
  }

  if (normalized.includes("missing edge admin key")) {
    return "Remote-Preview blockiert: lokaler Edge Admin Key fehlt.";
  }

  if (
    normalized.includes("missing or invalid admin") ||
    normalized.includes("invalid admin") ||
    normalized.includes("x-k1w1-admin-key") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden") ||
    normalized.includes("401") ||
    normalized.includes("403")
  ) {
    return "Remote-Preview blockiert: lokaler Edge Admin Key fehlt oder wurde vom Edge-Server abgelehnt (401/403).";
  }

  return "Remote-Preview konnte nicht zuverlässig bereitgestellt werden.";
}

interface ResolvePreviewDisplayStateOptions {
  phase: PreviewPhase;
  previewKind: "supabase" | "local" | null;
  previewSourceType: "url" | "html" | null;
  remoteUrlStatus: PreviewRemoteUrlStatus;
  hasExpiredRemoteUrl: boolean;
  remoteFailure: string | null;
  stateError: string | null;
  webError: string | null;
  transientLocalPreviewNotice: string | null;
}

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
      statusText:
        previewSourceType === "html"
          ? "Lokaler Fallback fehlgeschlagen"
          : "Preview fehlgeschlagen",
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

export function isPreviewExpired(expiresAt: string | null, now = new Date()): boolean {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry.getTime() <= now.getTime();
}

export function formatPreviewExpiry(expiresAt: string | null, now = new Date()): string {
  if (!expiresAt) return "Kein Ablauf hinterlegt (letzter bekannter Stand)";

  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return "Ablaufzeit konnte nicht gelesen werden";

  const diffMs = expiry.getTime() - now.getTime();
  if (diffMs <= 0) return "Abgelaufen – letzte URL wird nicht mehr geladen, bitte neu erstellen";

  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `Gültig für ca. ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Gültig für ca. ${hours} h`;

  const days = Math.round(hours / 24);
  return `Gültig für ca. ${days} Tage`;
}

export function getPreviewChannelLabel(source: "supabase" | "local" | null): string {
  if (source === "supabase") return "Primäre Remote-Preview (Supabase / Browser / QR)";
  if (source === "local") return "Lokaler HTML-/Eval-Fallback (nur Dev/Best-Effort, nur solange App aktiv ist)";
  return "Noch keine Preview aktiv";
}

export function getPreviewMixedContentMode(): "never" {
  return "never";
}

export function buildQrImageUrl(previewUrl: string): string {
  const normalized = String(previewUrl ?? "").trim();
  const encoded = encodeURIComponent(normalized);
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=16&data=${encoded}`;
}
