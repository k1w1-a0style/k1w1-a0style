// supabase/functions/android-keystore-export/helpers.ts
// Extracted from index.ts

// supabase/functions/android-keystore-export/index.ts
// CI-only endpoint: exports decrypted Android keystore + passwords.
// Hardens access:
// - Supabase verifies JWT by default. We additionally require:
//   1) x-k1w1-admin-key (optional enforcement via secret)
//   2) caller role == service_role (so the app's anon key cannot exfiltrate creds)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
export { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";
export {
  rateLimit,
  requireAdminKey,
  requireServiceRoleBearer,
  requireAdminKeyOrServiceRoleBearer,
  hasAdminKeySecretConfigured,
  hasServiceRoleSecretConfigured,
  getServiceRoleKey,
  getBearerToken,
} from "../_shared/auth.ts";

export type Mode = "development" | "preview" | "production";

export function resolveMode(v: unknown): Mode {
  const s = typeof v === "string" ? v.trim() : "";
  const lower = s.toLowerCase();
  if (lower === "dev") return "development";
  if (lower === "development" || lower === "preview" || lower === "production") return lower as Mode;
  return "production";
}


export function safeString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function repoOk(repo: string): boolean {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo);
}

export function base64UrlToString(b64url: string): string {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64);
}

export function getJwtRole(req: Request): string {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return "";
  const token = m[1].trim();
  const parts = token.split(".");
  if (parts.length < 2) return "";
  try {
    const payload = JSON.parse(base64UrlToString(parts[1]));
    const role = typeof payload?.role === "string" ? payload.role : "";
    return role;
  } catch {
    return "";
  }
}

export function getJwtSub(req: Request): string {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return "";
  const token = m[1].trim();
  const parts = token.split(".");
  if (parts.length < 2) return "";
  try {
    const payload = JSON.parse(base64UrlToString(parts[1]));
    return typeof payload?.sub === "string" ? payload.sub : "";
  } catch {
    return "";
  }
}

export async function deriveAesKeyBytes(masterKey: string): Promise<Uint8Array> {
  const input = new TextEncoder().encode(masterKey);
  const hash = await crypto.subtle.digest("SHA-256", input);
  return new Uint8Array(hash);
}

export function binaryStringToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

export async function decryptWithAesCbc(b64: string, masterKey: string): Promise<string> {
  const bytes = binaryStringToBytes(atob(b64));
  if (bytes.length < 17) throw new Error("Encrypted blob too small");
  const iv = bytes.slice(0, 16);
  const enc = bytes.slice(16);

  const keyBytes = await deriveAesKeyBytes(masterKey);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, [
    "decrypt",
  ]);
  const dec = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, enc);
  return new TextDecoder().decode(new Uint8Array(dec));
}

