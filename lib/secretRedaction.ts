/**
 * Terminal / debug log redaction helpers.
 *
 * Goal: keep logs useful while preventing accidental leakage of credentials.
 *
 * NOTE: This is best-effort pattern matching. We intentionally prefer false-positives
 * (redact too much) over false-negatives (leak secrets).
 */

const REDACTED = '<redacted>';
const REDACTED_JWT = '<redacted-jwt>';

function replaceAllSafe(
  input: string,
  re: RegExp,
  replacement: string | ((substring: string, ...args: any[]) => string)
): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (input as any).replace(re, replacement as any);
  } catch {
    return input;
  }
}

export function redactSecrets(input: string): string {
  let out = input;

  // Authorization header (covers "Authorization: Bearer ..." and other schemes).
  // We keep the "Bearer" scheme visible, because it is useful for debugging.
  // NOTE: avoid regex backtracking edge-cases that can accidentally drop "Bearer".
  out = replaceAllSafe(out, /(authorization\s*[:=]\s*)([^\n\r]+)/gi, (_m, p1: string, p2: string) => {
    const raw = String(p2);
    const trimmed = raw.trimStart();
    if (/^bearer\s+/i.test(trimmed)) {
      return `${p1}Bearer ${REDACTED}`;
    }
    return `${p1}${REDACTED}`;
  });

  // JWT-like token (3 dot-separated base64-ish parts).
  out = replaceAllSafe(
    out,
    /\beyJ[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{5,}\b/g,
    REDACTED_JWT
  );

  // Supabase anon/service role keys (best-effort).
  out = replaceAllSafe(
    out,
    /\b(anon|service)_key\s*[:=]\s*([A-Za-z0-9._-]{20,})\b/gi,
    `$1_key=${REDACTED}`
  );

  // Common API key formats (OpenAI/others): sk_*...
  out = replaceAllSafe(out, /\b(sk_(?:test_|live_)?[A-Za-z0-9]{10,})\b/g, REDACTED);

  // apiKey="..." / api_key: ...
  out = replaceAllSafe(
    out,
    /\b(api[_-]?key)\s*[:=]\s*"?([^\s"\n\r]{8,})"?/gi,
    `$1="${REDACTED}"`
  );

  // x-api-key headers.
  out = replaceAllSafe(
    out,
    /(x-api-key\s*[:=]\s*)([^\s\n\r]+)/gi,
    `$1${REDACTED}`
  );

  // npm auth tokens in .npmrc style files.
  out = replaceAllSafe(
    out,
    /(_authToken\s*[=:]\s*)([^\s\n\r]+)/gi,
    `$1${REDACTED}`
  );

  // Bearer tokens inside text.
  out = replaceAllSafe(out, /\bBearer\s+([A-Za-z0-9._-]{10,})\b/g, `Bearer ${REDACTED}`);

  // token= / access_token= / refresh_token=
  out = replaceAllSafe(
    out,
    /\b(access[_-]?token|refresh[_-]?token|token)\s*[:=]\s*"?([^\s"\n\r]{8,})"?/gi,
    `$1="${REDACTED}"`
  );

  return out;
}

/**
 * Truncate to a hard maximum while appending a marker.
 * If the marker itself is longer than maxChars, we return a clipped marker.
 */
export function truncateWithMarker(input: string, maxChars: number, marker = '…<truncated>'): string {
  if (maxChars <= 0) return '';
  if (input.length <= maxChars) return input;

  if (marker.length >= maxChars) {
    return marker.slice(0, maxChars);
  }

  const keep = maxChars - marker.length;
  return input.slice(0, keep) + marker;
}
