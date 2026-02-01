// supabase/functions/android-keystore-export/index.ts
// CI-only endpoint: exports decrypted Android keystore + passwords.
// Hardens access:
// - Supabase verifies JWT by default. We additionally require:
//   1) x-k1w1-admin-key (optional enforcement via secret)
//   2) caller role == service_role (so the app's anon key cannot exfiltrate creds)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { rateLimit, requireAdminKey } from "../_shared/auth.ts";

function safeString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function repoOk(repo: string): boolean {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo);
}

function base64UrlToString(b64url: string): string {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64);
}

function getJwtRole(req: Request): string {
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

async function deriveAesKeyBytes(masterKey: string): Promise<Uint8Array> {
  const input = new TextEncoder().encode(masterKey);
  const hash = await crypto.subtle.digest("SHA-256", input);
  return new Uint8Array(hash);
}

function binaryStringToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

async function decryptWithAesCbc(b64: string, masterKey: string): Promise<string> {
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

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const rl = rateLimit(req, "android-keystore-export", 30, 60_000);
  if (rl) return rl;

  // Optional enforcement via secret
  const admin = requireAdminKey(req);
  if (admin) return admin;

  // Hard block: only service_role JWT may export secrets
  const role = getJwtRole(req);
  if (role !== "service_role") {
    return errorResponse(
      "Forbidden",
      req,
      403,
      {
        hint: "This endpoint is CI-only. Use SUPABASE_SERVICE_ROLE_KEY as Bearer token.",
      },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const masterKey = Deno.env.get("SIGNING_MASTER_KEY");

    if (!supabaseUrl || !serviceKey) {
      return errorResponse("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", req, 500);
    }
    if (!masterKey || masterKey.trim().length < 24) {
      return errorResponse(
        "Missing SIGNING_MASTER_KEY (must be set as Supabase Edge Secret)",
        req,
        500,
      );
    }

    const body = await req.json().catch(() => ({}));
    const repo = safeString(body?.repo);

    if (!repoOk(repo)) {
      return errorResponse("Invalid repo format. Expected 'owner/name'.", req, 400);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data, error } = await supabase
      .from("signing_android")
      .select("repo, alias, storage_bucket, storage_path")
      .eq("repo", repo)
      .maybeSingle();

    if (error) return errorResponse("DB read failed", req, 500, { message: error.message });
    if (!data) return errorResponse("No signing record for repo", req, 404, { repo });

    const bucket = String(data.storage_bucket || "").trim();
    const path = String(data.storage_path || "").trim();
    if (!bucket || !path) {
      return errorResponse("Invalid signing record (missing bucket/path)", req, 500);
    }

    const { data: file, error: dlErr } = await supabase.storage.from(bucket).download(path);
    if (dlErr || !file) {
      return errorResponse("Storage download failed", req, 500, { message: dlErr?.message });
    }

    const encrypted = await file.text();
    const decrypted = await decryptWithAesCbc(encrypted, masterKey);
    const parsed = JSON.parse(decrypted);

    // CI expects base64 JKS/P12 and passwords.
    return jsonResponse(
      {
        ok: true,
        repo,
        alias: parsed.alias,
        keystoreBase64: parsed.keystoreBase64,
        keystorePassword: parsed.keystorePassword,
        keyPassword: parsed.keyPassword,
      },
      req,
    );
  } catch (e) {
    return errorResponse("Unhandled error", req, 500, { message: e?.message || String(e) });
  }
});
