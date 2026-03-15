// hooks/previewHelpers.ts
// Shared preview helper utilities to keep usePreview/usePreviewScreen aligned.

export type ProjectFile = { path?: string; content?: string };

export interface PreviewState {
  isCreating: boolean;
  lastCreatedAt: number | null;
  error: string | null;
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
  if (source === "supabase") return "Aktive Supabase-Preview (Browser/QR)";
  if (source === "local") return "Technischer Fallback: Lokale HTML-Preview (nur solange App aktiv ist)";
  return "Noch keine Preview aktiv";
}

export function buildQrImageUrl(previewUrl: string): string {
  const normalized = String(previewUrl ?? "").trim();
  const encoded = encodeURIComponent(normalized);
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=16&data=${encoded}`;
}
