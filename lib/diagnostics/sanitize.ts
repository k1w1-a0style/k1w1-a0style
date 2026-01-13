// lib/diagnostics/sanitize.ts

/**
 * Best-effort sanitization to avoid accidentally uploading secrets.
 * Not perfect, but helps prevent common accidental leaks.
 *
 * IMPORTANT:
 * - We prefer "scrub likely secrets" + "truncate big blobs" over trying to detect everything.
 * - This runs client-side before any upload.
 */

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

// key name heuristics (case-insensitive)
// Includes common variants like SECRET_1, token_v2, apiKey, accessKeyId, etc.
const SECRET_KEY_RE =
  /(secret|token|pass(word)?|api[_-]?key|apikey|access[_-]?key|private[_-]?key|client[_-]?secret|auth|bearer|session|cookie|jwt)/i;

// value heuristics
const JWT_RE =
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/;
const AWS_ACCESS_KEY_RE = /\b(AKIA|ASIA)[0-9A-Z]{16}\b/;
const PEM_BLOCK_RE =
  /-----BEGIN ([A-Z0-9 ]+ )?PRIVATE KEY-----[\s\S]*?-----END ([A-Z0-9 ]+ )?PRIVATE KEY-----/g;

// Long base64-ish blobs (often keys/binaries) – scrub if very long.
const LONG_B64_RE = /\b[A-Za-z0-9+/]{200,}={0,2}\b/g;

export type TruncateResult = { text: string; truncated: boolean };

/**
 * Truncate text safely for UI / uploads.
 * Returns an object so callers can display a "truncated" hint if needed.
 */
export function safeTruncate(input: string, maxChars: number): TruncateResult {
  if (input.length <= maxChars) return { text: input, truncated: false };
  const slice = input.slice(0, maxChars);
  const lastNl = slice.lastIndexOf("\n");
  const trimmed = lastNl > 200 ? slice.slice(0, lastNl) : slice;
  return { text: `${trimmed}\n/* …truncated… */\n`, truncated: true };
}

/** Convenience helper for places that only want the string. */
export function safeTruncateText(input: string, maxChars: number): string {
  return safeTruncate(input, maxChars).text;
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  if (!x || typeof x !== "object") return false;
  const proto = Object.getPrototypeOf(x);
  return proto === Object.prototype || proto === null;
}

function scrubStringValue(v: string): string {
  // PEM blocks first
  let out = v.replace(PEM_BLOCK_RE, "[REDACTED_PRIVATE_KEY]");
  // JWT
  out = out.replace(JWT_RE, "[REDACTED_JWT]");
  // AWS Access Key Id
  out = out.replace(AWS_ACCESS_KEY_RE, "[REDACTED_AWS_ACCESS_KEY_ID]");
  // Long base64 blobs
  out = out.replace(LONG_B64_RE, "[REDACTED_BLOB]");
  return out;
}

export function sanitizeText(text: string): string {
  const t = scrubStringValue(text);
  return t;
}

export function sanitizeJson(value: Json): Json {
  if (value === null) return null;
  if (typeof value === "string") return scrubStringValue(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((x) => sanitizeJson(x as Json));
  if (isPlainObject(value)) {
    const out: Record<string, Json> = {};
    for (const [k, v] of Object.entries(value)) {
      const keyLooksSecret = SECRET_KEY_RE.test(k);
      if (keyLooksSecret) {
        out[k] = "[REDACTED]";
        continue;
      }
      out[k] = sanitizeJson(v as Json);
    }
    return out;
  }
  // fallback
  return "[REDACTED]" as Json;
}

export function sanitizeJsonString(jsonText: string): string {
  try {
    const parsed = JSON.parse(jsonText) as Json;
    const cleaned = sanitizeJson(parsed);
    return JSON.stringify(cleaned, null, 2);
  } catch {
    // If it isn't JSON, scrub as text.
    return sanitizeText(jsonText);
  }
}

// Convenience wrapper for diagnostic uploads.
// Ensures we don't accidentally ship secrets or huge payloads.
export function sanitizeDiagnosticUpload<T>(payload: T): T {
  try {
    // sanitizeJson expects Json-compatible values; if not, just return payload.
    return sanitizeJson(payload as unknown as Json) as unknown as T;
  } catch {
    return payload;
  }
}
