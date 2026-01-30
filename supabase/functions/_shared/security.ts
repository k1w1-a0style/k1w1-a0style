/**
 * security.ts
 * Shared defensive helpers for Supabase Edge Functions.
 *
 * Goals:
 * - Prevent path traversal / weird path encodings
 * - Safe HTML escaping for log/preview rendering
 * - Safe JSON embedding into HTML <script> contexts
 */

export function escapeHtml(input: unknown): string {
  const s = String(input ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Safe JSON for embedding into HTML <script> tags.
 * - Escapes </script> breakers
 * - Escapes U+2028/U+2029 which can break JS in some contexts
 */
export function safeJsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Normalize a path-ish string to a safe "posix-like" path.
 * - Converts backslashes to slashes
 * - Removes duplicate slashes
 * - Trims whitespace
 * - Drops leading "./"
 * - Does NOT allow absolute paths
 */
export function normalizePath(p: unknown): string {
  let s = String(p ?? "").trim();
  if (!s) return "";

  // unify separators
  s = s.replace(/\\/g, "/");

  // remove repeated slashes
  s = s.replace(/\/{2,}/g, "/");

  // remove leading "./"
  s = s.replace(/^\.\//, "");

  // do not allow absolute paths
  if (s.startsWith("/")) s = s.slice(1);

  return s;
}

/**
 * Checks if a path is safe to use as a relative key/path inside storage/zip/etc.
 * Blocks:
 * - absolute paths (/..., \...)
 * - drive letters (C:\)
 * - path traversal segments (..)
 * - NULL bytes
 * - overly long paths
 */
export function isSafePath(p: unknown, maxLen = 512): boolean {
  const s0 = String(p ?? "");
  if (!s0) return false;

  if (s0.length > maxLen) return false;
  if (s0.includes("\0")) return false;

  const s = normalizePath(s0);

  if (!s) return false;

  // block absolute-ish
  if (s.startsWith("/") || s.startsWith("\\")) return false;

  // block windows drive letters
  if (/^[A-Za-z]:\//.test(s0.replace(/\\/g, "/"))) return false;

  // split and check traversal
  const parts = s.split("/").filter(Boolean);
  for (const part of parts) {
    if (part === "." || part === "..") return false;
    if (part.includes("..")) return false;
  }

  return true;
}
