// hooks/previewHelpers.ts
// Shared preview helper utilities to keep usePreview/usePreviewScreen aligned.

import { fetchWithTimeout } from "../lib/network/fetchWithTimeout";
import { isPreviewEdgeErrorCode, type PreviewEdgeErrorCode } from "../shared/previewErrorContract";
import type { PreviewFiles, PreviewResponse } from "../types/preview";

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

type PreviewInvokeError = Error & {
  status?: number;
  code?: PreviewEdgeErrorCode;
};

const PREVIEW_EDGE_ERROR_MESSAGES: Record<PreviewEdgeErrorCode, string> = {
  preview_env_missing: "Remote-Preview blockiert: Der Preview-Server ist nicht vollstaendig konfiguriert.",
  preview_db_error: "Remote-Preview konnte serverseitig nicht gespeichert oder geladen werden.",
  preview_payload_invalid: "Remote-Preview hat ungueltige oder leere Dateien erhalten.",
  preview_payload_too_large: "Remote-Preview ist zu gross fuer den Serververtrag.",
  preview_not_found: "Remote-Preview wurde auf dem Server nicht gefunden.",
  preview_expired: "Remote-Preview ist bereits abgelaufen. Bitte neu erstellen.",
  preview_response_too_large: "Remote-Preview konnte nicht ausgeliefert werden, weil die Antwort zu gross wurde.",
  preview_runtime_error: "Remote-Preview ist serverseitig beim Rendern fehlgeschlagen.",
  preview_unknown_internal_error: "Remote-Preview ist serverseitig intern fehlgeschlagen.",
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

export const EMPTY_REMOTE_PREVIEW_FILES_ERROR =
  "Keine zulaessigen Projektdateien fuer Remote-Preview gefunden.";

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

export function describeEmptyRemotePreviewFiles(params: {
  projectFileCount: number;
  allowedFileCount: number;
  skippedCount: number;
}): string {
  const { projectFileCount, allowedFileCount, skippedCount } = params;

  if (allowedFileCount > 0) {
    return EMPTY_REMOTE_PREVIEW_FILES_ERROR;
  }

  if (projectFileCount <= 0) {
    return `${EMPTY_REMOTE_PREVIEW_FILES_ERROR} Das Projekt enthaelt aktuell keine Dateien.`;
  }

  if (skippedCount > 0) {
    return `${EMPTY_REMOTE_PREVIEW_FILES_ERROR} ${skippedCount} Datei(en) wurden vom Preview-Filter ausgeschlossen.`;
  }

  return EMPTY_REMOTE_PREVIEW_FILES_ERROR;
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

export function shouldUseLocalPreviewFallback(mode: PreviewAttemptMode): boolean {
  return mode === "local";
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

function getPreviewEdgeErrorCode(error: unknown): PreviewEdgeErrorCode | null {
  const directCode = (error as { code?: unknown } | null)?.code;
  if (isPreviewEdgeErrorCode(directCode)) return directCode;

  if (error && typeof error === "object") {
    const nestedCode = (error as { response?: { code?: unknown } }).response?.code;
    if (isPreviewEdgeErrorCode(nestedCode)) return nestedCode;
  }

  return null;
}

export function describeRemotePreviewFailure(params: {
  bearerJwt?: string | null;
  statusCode?: number | null;
  error: unknown;
}): string {
  const message =
    params.error instanceof Error
      ? params.error.message
      : typeof params.error === "string"
        ? params.error
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

  const errorCode = getPreviewEdgeErrorCode(params.error);
  if (errorCode) {
    return PREVIEW_EDGE_ERROR_MESSAGES[errorCode];
  }

  if (
    normalized.includes("files fehlt/leer") ||
    normalized.includes("no valid files") ||
    normalized.includes("keine zulaessigen projektdateien")
  ) {
    return EMPTY_REMOTE_PREVIEW_FILES_ERROR;
  }

  if (!String(params.bearerJwt ?? "").trim()) {
    return "Remote-Preview blockiert: Supabase-Login-JWT fehlt oder ist lokal nicht verfuegbar.";
  }

  if (
    params.statusCode === 401 ||
    params.statusCode === 403 ||
    normalized.includes("bearer") ||
    normalized.includes("jwt") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden")
  ) {
    return "Remote-Preview blockiert: Der aktuelle Supabase-Login-JWT wurde vom Preview-Edge-Vertrag abgelehnt.";
  }

  return "Remote-Preview konnte nicht zuverlässig bereitgestellt werden.";
}

function buildPreviewInvokeError(
  message: string,
  status?: number,
  code?: PreviewEdgeErrorCode,
): PreviewInvokeError {
  const error = new Error(message) as PreviewInvokeError;
  if (typeof status === "number") {
    error.status = status;
  }
  if (code) {
    error.code = code;
  }
  return error;
}

type RuntimeGlobals = typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

function getRuntimeSupabaseUrl(): string | null {
  const runtime = globalThis as RuntimeGlobals;
  const envUrl = runtime.process?.env?.EXPO_PUBLIC_SUPABASE_URL;
  return typeof envUrl === "string" && envUrl.trim() ? envUrl.trim() : null;
}

export async function invokeSavePreview(params: {
  bearerJwt: string;
  payload: {
    projectId?: string;
    name: string;
    files: PreviewFiles;
    dependencies: Record<string, string>;
    meta: Record<string, unknown>;
  };
  timeoutMs?: number;
}): Promise<PreviewResponse> {
  const supabaseUrl = getRuntimeSupabaseUrl();
  if (!supabaseUrl) {
    throw buildPreviewInvokeError("Supabase URL fehlt.");
  }

  const timeoutMs = params.timeoutMs ?? 12_000;

  try {
    const res = await fetchWithTimeout(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/save_preview`, {
      timeoutMs,
      timeoutMessage: `Supabase Preview Timeout (${timeoutMs}ms)`,
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${params.bearerJwt.trim()}`,
      },
      body: JSON.stringify(params.payload),
    });

    const rawText = await res.text();
    const parsed = rawText ? safeJson<PreviewResponse>(rawText) : null;
    const errorCode = isPreviewEdgeErrorCode(parsed?.code) ? parsed.code : null;
    const errorMessage =
      typeof parsed?.error === "string" && parsed.error.trim()
        ? parsed.error.trim()
        : rawText.trim() || `HTTP ${res.status}`;

    if (!res.ok) {
      throw buildPreviewInvokeError(errorMessage, res.status, errorCode ?? undefined);
    }

    if (parsed && parsed.ok === false) {
      throw buildPreviewInvokeError(errorMessage, res.status, errorCode ?? undefined);
    }

    return parsed ?? { ok: false, error: "Leere Preview-Antwort" };
  } catch (error: unknown) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      throw buildPreviewInvokeError(`Supabase Preview Timeout (${timeoutMs}ms)`);
    }
    throw error;
  }
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
