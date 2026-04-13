const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

/**
 * Client-side JWT convenience helper for UI/readiness/preflight checks only.
 *
 * IMPORTANT:
 * - This module only decodes and reads the JWT payload (`header.payload.signature` -> payload).
 * - It does NOT perform any cryptographic signature verification.
 * - It MUST NOT be treated as a security gate or authorization source.
 * - Authoritative authorization remains server-/edge-side (fail-closed verification there).
 */
function decodeBase64Url(input: string): string | null {
  if (!BASE64URL_RE.test(input)) return null;
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  try {
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return null;
  }
}

export function readOperatorJwtRole(token: string | null | undefined): string | null {
  const raw = String(token ?? "").trim();
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const payloadText = decodeBase64Url(parts[1] ?? "");
  if (!payloadText) return null;
  try {
    const payload = JSON.parse(payloadText) as Record<string, unknown>;
    const roleFromRoot = typeof payload.role === "string" ? payload.role : null;
    if (roleFromRoot) return roleFromRoot;
    const appMeta =
      payload.app_metadata && typeof payload.app_metadata === "object"
        ? (payload.app_metadata as Record<string, unknown>)
        : null;
    return appMeta && typeof appMeta.role === "string" ? appMeta.role : null;
  } catch {
    return null;
  }
}

/**
 * Convenience role precheck for client-side UX gating only.
 * No signature verification happens here; server-/edge-side auth stays authoritative.
 */
export function hasAllowedOperatorRole(token: string | null | undefined): boolean {
  const role = readOperatorJwtRole(token);
  return role === "build_admin" || role === "service_role";
}
