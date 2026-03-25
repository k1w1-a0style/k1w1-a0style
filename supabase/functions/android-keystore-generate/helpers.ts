// supabase/functions/android-keystore-generate/helpers.ts
// Extracted from index.ts.
// supabase/functions/android-keystore-generate/index.ts
// Generates an Android keystore server-side, stores it encrypted in Supabase Storage,
// and persists metadata in the `signing_android` table.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
export { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";
export { getServiceRoleKey, getSigningMasterKey, getSupabaseUrl, rateLimit, requireAdminKey } from "../_shared/auth.ts";


export type Mode = "development" | "preview" | "production";

// Back-compat: older clients send "dev" instead of "development".
export function resolveMode(input: string): Mode {
  const m = (input || "").trim().toLowerCase();
  if (!m) return "production";
  if (m === "dev") return "development";
  if (m === "development" || m === "preview" || m === "production") return m;
  throw new Error("Invalid mode. Expected dev|development|preview|production.");
}
// node-forge loader (lazy) + WebCrypto RNG patch
let _forgePromise: Promise<any> | null = null;

export function bytesToBinaryStringChunked(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let out = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return out;
}

export async function getForge(): Promise<any> {
  if (_forgePromise) return _forgePromise;

  _forgePromise = (async () => {
    // If your Edge runtime blocks esm.sh at runtime, vendor forge or use an allowed host.
    const mod: any = await import(
      "https://esm.sh/node-forge@1.3.1?pin=v135&target=deno",
    );
    const forge: any = mod?.default ?? mod;

    if (!globalThis.crypto?.getRandomValues) {
      throw new Error("WebCrypto not available: crypto.getRandomValues is missing");
    }

    const rngBytes = (count: number) => {
      const buf = new Uint8Array(count);
      globalThis.crypto.getRandomValues(buf);
      return bytesToBinaryStringChunked(buf);
    };

    forge.random.getBytesSync = (count: number) => rngBytes(count);
    forge.random.getBytes = (count: number, cb?: any) => {
      const out = rngBytes(count);
      // node-forge supports BOTH forms:
      //   getBytes(n) -> string
      //   getBytes(n, cb) -> void (cb(err, string))
      if (typeof cb === "function") {
        try {
          cb(null, out);
        } catch (e) {
          cb(e, "");
        }
        return;
      }
      return out;
    };

    return forge;
  })().catch((e) => {
    _forgePromise = null;
    throw e;
  });

  return _forgePromise;
}

export function safeString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function repoOk(repo: string): boolean {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo);
}

export async function deriveAesKeyBytes(masterKey: string): Promise<Uint8Array> {
  // Derive a stable 32-byte key from any masterKey string using SHA-256.
  const input = new TextEncoder().encode(masterKey);
  const hash = await crypto.subtle.digest("SHA-256", input);
  return new Uint8Array(hash); // 32 bytes
}

export function bytesToBinaryString(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

export async function encryptWithAesCbc(payload: string, masterKey: string): Promise<string> {
  const keyBytes = await deriveAesKeyBytes(masterKey);
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes as unknown as BufferSource,
    { name: "AES-CBC" },
    false,
    ["encrypt"],
  );

  const data = new TextEncoder().encode(payload);
  const enc = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, key, data);
  const out = new Uint8Array(iv.length + enc.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(enc), iv.length);

  // base64
  return btoa(bytesToBinaryString(out));
}

export async function encryptText(text: string, masterKey: string): Promise<string> {
  return encryptWithAesCbc(text, masterKey);
}

export async function ensureBucketExists(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  bucket: string,
): Promise<void> {
  // Best-effort: try storage API, fallback to inserting into storage.buckets.
  // Using service role key => allowed.
  try {
    const { error } = await supabase.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: "10mb",
    });
    if (!error) return;
    // If it already exists, ignore.
    if (String(error?.message || "").toLowerCase().includes("already")) return;
  } catch {
    // ignore, try fallback
  }

  // Fallback: insert directly into storage.buckets (works in Supabase Postgres).
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("storage.buckets")
      .insert({ id: bucket, name: bucket, public: false })
      .select("id")
      .maybeSingle();
    if (error) {
      // Duplicate => ok
      const msg = String(error.message || "").toLowerCase();
      if (msg.includes("duplicate") || msg.includes("already")) return;
      throw error;
    }
  } catch (e) {
    // If we can't ensure the bucket, fail loudly – upload will fail anyway.
    throw new Error(`Could not ensure storage bucket '${bucket}': ${e?.message || String(e)}`);
  }
}
