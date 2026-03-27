import type { WizardHttpDebug } from "../types";
import { isLikelyValidAdminKey } from "../../../lib/security/isLikelyValidAdminKey";

// Defensive redaction helpers.
// Goal: never leak secrets in UI, logs, or clipboard.

const MAX_DEBUG_CHARS = 6000;
const MAX_ERROR_CHARS = 2000;

// Rough JWT detector (base64url.base64url.base64url)
const JWT_RE = /\b([A-Za-z0-9_-]{8,})\.([A-Za-z0-9_-]{8,})\.([A-Za-z0-9_-]{8,})\b/g;

// Replace common key/value secret patterns (keeps the key, redacts value)
// - supports both unquoted (key=value) and quoted (key="value") variants
const KEY_VALUE_SECRET_RE =
  /(api\s*key|apikey|apiKey|admin\s*key|service\s*role|secret|token|password|bearer|authorization)\s*[:=]\s*([^\s"',\n\r]{6,})/gi;

const QUOTED_KV_SECRET_RE =
  /(api\s*key|apikey|apiKey|admin\s*key|service\s*role|secret|token|password)\s*[:=]\s*(["'])([^"'\n\r]{6,})(\2)/gi;

// Bearer header style (e.g. "Bearer <token>")
const BEARER_RE = /\bBearer\s+([^\s"',\n\r]{6,})/gi;

function withTruncatedMarker(base: string, maxChars: number): string {
  const marker = "\n<truncated>";
  const keep = Math.max(0, maxChars - marker.length);
  return `${base.slice(0, keep)}${marker}`;
}

function truncateWithMarker(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return withTruncatedMarker(text, maxChars);
}

export function sanitizeText(text: string, maxChars: number): string {
  const input = typeof text === "string" ? text : String(text);
  let out = input;
  const wasTooLong = input.length > maxChars;

  // Redact explicit key/value pairs
  out = out.replace(KEY_VALUE_SECRET_RE, (_m, k) => `${String(k)}: <redacted>`);

  // Redact explicit quoted key/value pairs (keeps quotes)
  out = out.replace(QUOTED_KV_SECRET_RE, (_m, k, q) => `${String(k)}=${String(q)}<redacted>${String(q)}`);

  // Redact bearer tokens
  out = out.replace(BEARER_RE, "Bearer <redacted>");

  // Redact JWT-like tokens
  out = out.replace(JWT_RE, "<redacted-jwt>");

  // Defensive: redact long random-looking tokens (base64url-ish) if present
  out = out.replace(/\b[A-Za-z0-9_-]{40,}\b/g, "<redacted-token>");

  // Truncate output, but if the *input* was huge we still mark it as truncated
  // even when redaction shrinks it below max.
  if (out.length > maxChars) return truncateWithMarker(out, maxChars);
  if (wasTooLong) return withTruncatedMarker(out, maxChars);
  return out;
}

export function sanitizeWizardHttpDebug(debug: WizardHttpDebug): WizardHttpDebug {
  return {
    url: sanitizeText(debug.url, 400),
    method: debug.method ? sanitizeText(debug.method, 16) : undefined,
    ms: typeof debug.ms === "number" ? debug.ms : undefined,
    status: debug.status,
    statusText: debug.statusText ? sanitizeText(debug.statusText, 200) : undefined,
    bodyText: sanitizeText(debug.bodyText, MAX_DEBUG_CHARS),
  };
}

export function sanitizeErrorForUi(errorText: string): string {
  return sanitizeText(errorText, MAX_ERROR_CHARS);
}

export function buildEdgeHttpErrorMessage(status: number, statusText: string, bodyText: string): string {
  const base = `HTTP ${status} ${statusText || ""}`.trim();
  if (!bodyText) return base;

  try {
    const parsed = JSON.parse(bodyText) as Record<string, unknown>;
    const details =
      typeof parsed.details === "object" && parsed.details
        ? (parsed.details as Record<string, unknown>)
        : null;

    const explicit =
      (typeof parsed.error === "string" && parsed.error.trim()) ||
      (typeof parsed.message === "string" && parsed.message.trim()) ||
      (details && typeof details.error === "string" && details.error.trim()) ||
      (details && typeof details.message === "string" && details.message.trim()) ||
      "";

    if (explicit) return `${base}: ${explicit}`;
  } catch {
    // Fall through to safe text snippet.
  }

  const snippet = bodyText.replace(/\s+/g, " ").trim().slice(0, 180);
  return snippet ? `${base}: ${snippet}` : base;
}

export function isLikelyValidSupabaseUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:") return false;
    if (!u.hostname) return false;
    // allow custom domains, but common case is *.supabase.co
    // if it's supabase.co, keep it strict to avoid typos.
    if (u.hostname.endsWith("supabase.co") && !u.hostname.includes(".")) return false;
    return true;
  } catch {
    return false;
  }
}

export { isLikelyValidAdminKey };

export function isLikelyValidRepoFullName(repo: string): boolean {
  const r = repo.trim();
  if (!r) return false;
  if (/\s/.test(r)) return false;
  const parts = r.split("/");
  if (parts.length !== 2) return false;
  if (!parts[0] || !parts[1]) return false;
  return true;
}
