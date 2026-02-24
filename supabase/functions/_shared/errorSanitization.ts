/**
 * errorSanitization.ts
 *
 * Purpose:
 * - Prevent secret leakage via Edge Function error bodies.
 * - Keep client-facing errors actionable but safe.
 */

const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const GITHUB_TOKEN_RE = /\bgh[pous]_[A-Za-z0-9]{20,}\b/g;
const BEARER_RE = /\bBearer\s+[^\s"']+/gi;

const REDACTED_TOKEN = "[REDACTED_TOKEN]";
const REDACTED_SECRET = "[REDACTED_SECRET]";

// Generic "long secret" heuristic (avoid nuking normal text too aggressively)
// - requires at least one digit and one letter
// - length >= 32
const LONG_SECRET_RE = /\b(?=[A-Za-z0-9_-]{32,}\b)(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9_-]+\b/g;

export function sanitizeErrorText(text: unknown, maxLen = 500): string {
  let s = String(text ?? "");

  // Normalize whitespace (keeps logs readable)
  s = s.replace(/\r\n/g, "\n");

  // Redactions
  // Use a single stable marker so tests/log scrapers can key on it.
  s = s.replace(JWT_RE, REDACTED_TOKEN);
  s = s.replace(GITHUB_TOKEN_RE, REDACTED_TOKEN);
  // Keep the "Bearer" prefix to preserve context.
  s = s.replace(BEARER_RE, `Bearer ${REDACTED_TOKEN}`);
  s = s.replace(LONG_SECRET_RE, REDACTED_SECRET);

  // Hard cap
  if (s.length > maxLen) {
    s = s.slice(0, maxLen - 14) + "…[truncated]";
  }

  return s;
}

export function sanitizeGitHubFailure(r: Response, bodyText: string): {
  status: number;
  statusText?: string;
  message: string;
} {
  return {
    status: r.status,
    statusText: r.statusText || undefined,
    message: sanitizeErrorText(bodyText),
  };
}

type JsonLike =
  | null
  | boolean
  | number
  | string
  | JsonLike[]
  | { [key: string]: JsonLike };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function isSensitiveKeyName(key: string): boolean {
  const k = key.toLowerCase();
  // Keep this conservative: only redact obvious secret containers.
  return (
    k.includes("token") ||
    k.includes("secret") ||
    k.includes("apikey") ||
    k.includes("api_key") ||
    k.includes("authorization") ||
    k.includes("service_role") ||
    k.includes("password")
  );
}

/**
 * Best-effort deep sanitization for error details that may contain secrets.
 * - Redacts known token/key patterns from strings
 * - Walks arrays/objects up to a depth limit
 * - Leaves numbers/booleans/null as-is
 */
export function sanitizeUnknownForTransport(input: unknown, maxDepth = 4): JsonLike {
  const walk = (v: unknown, depth: number): JsonLike => {
    if (v === null || v === undefined) return null;
    if (typeof v === "string") return sanitizeErrorText(v);
    if (typeof v === "number") return v;
    if (typeof v === "boolean") return v;
    if (typeof v === "bigint") return sanitizeErrorText(v.toString());
    if (typeof v === "function" || typeof v === "symbol") return null;
    if (depth <= 0) return sanitizeErrorText("[truncated]");

    if (Array.isArray(v)) {
      return v.slice(0, 50).map((item) => walk(item, depth - 1));
    }

    if (v instanceof Error) {
      return {
        name: sanitizeErrorText(v.name || "Error"),
        message: sanitizeErrorText(v.message || ""),
      };
    }

    if (isPlainObject(v)) {
      const out: Record<string, JsonLike> = {};
      const entries = Object.entries(v).slice(0, 50);
      for (const [k, val] of entries) {
        if (isSensitiveKeyName(k)) {
          out[k] = REDACTED_SECRET;
        } else {
          out[k] = walk(val, depth - 1);
        }
      }
      return out;
    }

    // Fallback: stringify (may include tokens, so sanitize)
    try {
      return sanitizeErrorText(String(v));
    } catch {
      return sanitizeErrorText("[unprintable]");
    }
  };

  return walk(input, maxDepth);
}
