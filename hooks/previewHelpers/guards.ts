import { ALLOWED_EXTENSIONS, EMPTY_REMOTE_PREVIEW_FILES_ERROR, IGNORED_PATTERNS } from "./constants";
import type { PreviewAttemptMode, PreviewRemoteUrlStatus, ProjectFile } from "./types";

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

export function shouldAttemptSupabaseFirst(mode: PreviewAttemptMode): boolean {
  return mode !== "local";
}

export function shouldUseLocalPreviewFallback(mode: PreviewAttemptMode): boolean {
  return mode === "local";
}
