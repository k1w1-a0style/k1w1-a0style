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

// Generic "long secret" heuristic (avoid nuking normal text too aggressively)
// - requires at least one digit and one letter
// - length >= 32
const LONG_SECRET_RE = /\b(?=[A-Za-z0-9_-]{32,}\b)(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9_-]+\b/g;

export function sanitizeErrorText(text: unknown, maxLen = 500): string {
  let s = String(text ?? "");

  // Normalize whitespace (keeps logs readable)
  s = s.replace(/\r\n/g, "\n");

  // Redactions
  s = s.replace(JWT_RE, "[JWT_REDACTED]");
  s = s.replace(GITHUB_TOKEN_RE, "[GITHUB_TOKEN_REDACTED]");
  s = s.replace(BEARER_RE, "Bearer [REDACTED]");
  s = s.replace(LONG_SECRET_RE, "[SECRET_REDACTED]");

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
