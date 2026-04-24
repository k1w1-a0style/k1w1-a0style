// supabase/functions/preview_page/helpers.ts
// Extracted from preview_page/index.ts: utility functions.

// supabase/functions/preview_page/index.ts
// Serves a preview page for a previously "saved preview" (by secret).
// NOTE: Preview runs in a sandbox. Do NOT put secrets/service keys into preview files.

import {
  createPreviewEdgeErrorPayload,
  isPreviewEdgeErrorCode,
  PREVIEW_EDGE_ERROR_MESSAGE,
  PREVIEW_EDGE_ERROR_STATUS,
  PREVIEW_ERROR_HEADER,
  type PreviewEdgeErrorCode,
} from "../../../shared/previewErrorContract.ts";
import {
  getPreviewServiceRoleKey,
  getPreviewSupabaseUrl,
  getRequestClientIp,
  getRequestRateLimitSubject,
  getRuntimeEnv,
  rateLimit,
  requireDurableRateLimit,
} from "../_shared/auth.ts";
// NOTE: Supabase Edge (Deno) bundler requires explicit file extensions for local imports.
import { sanitizeErrorText } from "../_shared/errorSanitization.ts";

export { getRequestClientIp, getRequestRateLimitSubject, rateLimit, requireDurableRateLimit, sanitizeErrorText };

export type SnackFiles = Record<string, { type?: string; contents: string }>;

export type PreviewRecord = {
  name: string;
  secret: string;
  created_at: string;
  expires_at: string;
  project_id?: string | null;
  files: SnackFiles;
  dependencies: Record<string, string> | null;
  meta: Record<string, unknown> | null;
};

export type PreviewRecordLookupResult =
  | { ok: true; record: PreviewRecord | null }
  | { ok: false; code: PreviewEdgeErrorCode };

export const TABLE = "previews";

// Limits
export const MAX_FILES_BYTES = 1_500_000; // 1.5MB (aligned with save_preview)
export const MAX_RESPONSE_BYTES = 5_000_000; // 5MB safety for generated HTML

// Rate limiting (best-effort, in-memory; resets on cold start)
export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      ...(headers ?? {}),
    },
  });
}

export function previewErrorHeaders(
  code: PreviewEdgeErrorCode,
  extraHeaders?: HeadersInit,
): HeadersInit {
  return {
    [PREVIEW_ERROR_HEADER]: code,
    ...(extraHeaders ?? {}),
  };
}

export function jsonPreviewError(params: {
  code: PreviewEdgeErrorCode;
  message?: string;
  status?: number;
}) {
  const status = params.status ?? PREVIEW_EDGE_ERROR_STATUS[params.code];
  return json(
    createPreviewEdgeErrorPayload(params.code, params.message),
    status,
    previewErrorHeaders(params.code),
  );
}

export function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function safeJsonForScript(obj: unknown): string {
  // Prevent </script> breakouts and other HTML/script parsing edge-cases when embedding JSON into <script>.
  // This keeps the JSON valid while replacing characters that have special meaning in HTML parsing contexts.
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function getSupabaseBaseUrl(): string {
  // Keep consistent with your save_preview function (uses PREVIEW_SUPABASE_URL)
  return getPreviewSupabaseUrl() ?? "";
}

export function supabaseHeaders(): Record<string, string> {
  // Keep consistent with your save_preview function (uses PREVIEW_SERVICE_ROLE_KEY)
  const key = getPreviewServiceRoleKey() ?? "";
  if (!key) throw new Error("Missing PREVIEW_SERVICE_ROLE_KEY");

  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
  };
}

export function utf8Size(s: string): number {
  return new TextEncoder().encode(s).length;
}

export function approxFilesPayloadSize(files: SnackFiles): number {
  try {
    return utf8Size(JSON.stringify(files));
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

export function randomNonce(len = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return btoa(String.fromCharCode(...bytes)).replace(/=+$/g, "");
}

const PREVIEW_SECRET_HASH_PREFIX = "psh_v1_";

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function hashPreviewSecret(secret: string): Promise<string> {
  const input = new TextEncoder().encode(secret.trim());
  const digest = await crypto.subtle.digest("SHA-256", input);
  return PREVIEW_SECRET_HASH_PREFIX + bytesToBase64Url(new Uint8Array(digest));
}

export async function buildPreviewSecretCandidates(secret: string): Promise<string[]> {
  const raw = secret.trim();
  if (!raw) return [];
  if (raw.startsWith(PREVIEW_SECRET_HASH_PREFIX)) return [raw];
  const hashed = await hashPreviewSecret(raw);
  return [hashed];
}

export async function findFirstByPreviewSecretCandidates<T>(
  secret: string,
  lookup: (candidate: string) => Promise<T | null>,
): Promise<T | null> {
  const candidates = await buildPreviewSecretCandidates(secret);
  for (const candidate of candidates) {
    const result = await lookup(candidate);
    if (result != null) return result;
  }
  return null;
}

export async function deleteByPreviewSecretCandidates(
  secret: string,
  remove: (candidate: string) => Promise<void>,
): Promise<void> {
  const candidates = await buildPreviewSecretCandidates(secret);
  for (const candidate of candidates) {
    await remove(candidate);
  }
}

export function isValidPreviewSecretFormat(secret: string): boolean {
  const trimmed = secret.trim();
  if (!trimmed) return false;
  if (trimmed.length < 16 || trimmed.length > 128) return false;
  return /^[A-Za-z0-9_-]+$/.test(trimmed);
}

export function buildCsp(nonce: string): string {
  // Preview-Default ist jetzt enger:
  // - `unsafe-eval` ist standardmäßig AUS und muss explizit eingeschaltet werden
  //   (`PREVIEW_ALLOW_UNSAFE_EVAL=true`) für den Sandpack-Tradeoff.
  // - esm.sh bleibt Standardquelle für Modul-Imports; kann aber bewusst deaktiviert werden
  //   (`PREVIEW_ALLOW_ESM_SH_CDN=false`) falls ein alternativer Loader genutzt wird.
  const allowUnsafeEval =
    (getRuntimeEnv("PREVIEW_ALLOW_UNSAFE_EVAL") ?? "").toLowerCase() === "true";
  const allowEsmShCdn =
    (getRuntimeEnv("PREVIEW_ALLOW_ESM_SH_CDN") ?? "").toLowerCase() !== "false";
  const evalPart = allowUnsafeEval ? " 'unsafe-eval'" : "";
  const esmShPart = allowEsmShCdn ? " https://esm.sh" : "";

  return [
    "default-src 'self' data: blob:",
    "img-src 'self' https: data: blob:",
    "media-src 'self' https: data: blob:",
    "font-src 'self' https: data: blob:",
    "style-src 'self' 'unsafe-inline' https: data: blob:",
    `script-src 'self' 'nonce-${nonce}'${evalPart}${esmShPart}`,
    "connect-src 'self' https: wss: data: blob:",
    "frame-src 'self' https: data: blob:",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function html(body: string, nonce: string, status = 200, headers?: HeadersInit) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",

      // Supabase can inject a very strict CSP (default-src 'none'; sandbox),
      // which breaks Sandpack/WebViews (white screen). Override it here.
      "Content-Security-Policy": buildCsp(nonce),
      "Referrer-Policy": "no-referrer",
      ...(headers ?? {}),
    },
  });
}

export function htmlPreviewError(params: {
  code: PreviewEdgeErrorCode;
  nonce: string;
  title: string;
  message: string;
  status?: number;
}) {
  return html(
    `<!doctype html><meta charset="utf-8"><title>${escapeHtml(params.title)}</title><pre data-preview-error-code="${escapeHtml(params.code)}">${escapeHtml(params.message)}</pre>`,
    params.nonce,
    params.status ?? PREVIEW_EDGE_ERROR_STATUS[params.code],
    previewErrorHeaders(params.code),
  );
}

export function previewPageErrorResponse(params: {
  code: PreviewEdgeErrorCode;
  nonce: string;
  title?: string;
  message?: string;
  status?: number;
}) {
  return htmlPreviewError({
    code: params.code,
    nonce: params.nonce,
    title: params.title ?? "Preview Error",
    message: params.message ?? PREVIEW_EDGE_ERROR_MESSAGE[params.code],
    status: params.status,
  });
}

export function classifyPreviewRecordLookupFailure(params: {
  missingBaseUrl?: boolean;
  missingServiceRoleKey?: boolean;
  status?: number | null;
  contentType?: string | null;
  parseFailed?: boolean;
  error?: unknown;
}): PreviewEdgeErrorCode {
  if (params.missingBaseUrl || params.missingServiceRoleKey) {
    return "preview_env_missing";
  }

  if (params.status != null && params.status >= 400) {
    return "preview_db_error";
  }

  if (params.parseFailed) {
    return "preview_db_error";
  }

  if (params.contentType && !params.contentType.toLowerCase().includes("application/json")) {
    return "preview_db_error";
  }

  if (params.error) {
    const message = sanitizeErrorText(params.error instanceof Error ? params.error.message : String(params.error));
    if (isPreviewEdgeErrorCode(message)) {
      return message;
    }
    return "preview_db_error";
  }

  return "preview_db_error";
}

export function classifyPreviewRecordShape(record: PreviewRecord | null): PreviewEdgeErrorCode | null {
  if (!record) return null;
  if (!record.files || typeof record.files !== "object" || Array.isArray(record.files)) {
    return "preview_payload_invalid";
  }
  return null;
}

export function classifyPreviewPageUnexpectedError(error: unknown): PreviewEdgeErrorCode {
  if (isPreviewEdgeErrorCode(error)) {
    return error;
  }

  const message = sanitizeErrorText(error instanceof Error ? error.message : String(error ?? ""));
  if (!message.trim()) {
    return "preview_unknown_internal_error";
  }
  return "preview_runtime_error";
}
