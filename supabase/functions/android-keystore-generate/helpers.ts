// supabase/functions/android-keystore-generate/helpers.ts
// Extracted from index.ts.
// supabase/functions/android-keystore-generate/index.ts
// Generates an Android keystore server-side, stores it encrypted in Supabase Storage,
// and persists metadata in the `signing_android` table.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  deriveAesKeyBytes,
  encryptKeystorePayload,
  encryptWithAesCbcLegacy,
} from "../_shared/androidKeystoreCrypto.ts";
import { isSafeGitHubRepoFullName } from "../_shared/validation.ts";
export { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";
export {
  getRequestClientIp,
  getRequestRateLimitSubject,
  getServiceRoleKey,
  getSigningMasterKey,
  getSupabaseUrl,
  rateLimit,
  requireDurableRateLimit,
  requirePrivilegedOperatorJwtRole,
  requireScopedEdgeAuth,
} from "../_shared/auth.ts";


export type Mode = "development" | "preview" | "production";
type StorageBucketsQuery = {
  from: (
    table: "storage.buckets",
  ) => {
    insert: (payload: { id: string; name: string; public: boolean }) => {
      select: (columns: "id") => { maybeSingle: () => Promise<{ error?: { message?: string } | null }> };
    };
  };
};

// Back-compat: older clients send "dev" instead of "development".
export function resolveMode(input: string): Mode {
  const m = (input || "").trim().toLowerCase();
  if (!m) return "production";
  if (m === "dev") return "development";
  if (m === "development" || m === "preview" || m === "production") return m;
  throw new Error("Invalid mode. Expected dev|development|preview|production.");
}
// node-forge loader (lazy) + WebCrypto RNG patch


type ForgeGetBytesCallback = (error: unknown, bytes: string) => void;

type ForgeCertificate = {
  publicKey: unknown;
  serialNumber: string;
  validity: { notBefore: Date; notAfter: Date };
  setSubject: (attrs: Array<{ name: string; value: string }>) => void;
  setIssuer: (attrs: Array<{ name: string; value: string }>) => void;
  setExtensions: (extensions: Array<Record<string, unknown>>) => void;
  sign: (privateKey: unknown, md: unknown) => void;
};

type ForgeRuntime = {
  random: {
    getBytesSync: (count: number) => string;
    getBytes: (count: number, cb?: ForgeGetBytesCallback) => string | void;
  };
  util: { bytesToHex: (bytes: string) => string };
  pki: {
    privateKeyFromAsn1: (asn1: unknown) => unknown;
    publicKeyFromAsn1: (asn1: unknown) => unknown;
    createCertificate: () => ForgeCertificate;
  };
  asn1: {
    fromDer: (input: string) => unknown;
    toDer: (asn1: unknown) => { getBytes: () => string };
  };
  md: { sha256: { create: () => unknown } };
  pkcs12: {
    toPkcs12Asn1: (
      privateKey: unknown,
      certs: ForgeCertificate[],
      password: string,
      options: { algorithm: string; friendlyName: string; generateLocalKeyId: boolean },
    ) => unknown;
  };
};
let _forgePromise: Promise<ForgeRuntime> | null = null;

export function bytesToBinaryStringChunked(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let out = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return out;
}

export async function getForge(): Promise<ForgeRuntime> {
  if (_forgePromise) return _forgePromise;

  _forgePromise = (async () => {
    // If your Edge runtime blocks esm.sh at runtime, vendor forge or use an allowed host.
    const mod = (await import(
      "https://esm.sh/node-forge@1.3.1?pin=v135&target=deno",
    )) as { default?: ForgeRuntime } & ForgeRuntime;
    const forge: ForgeRuntime = mod.default ?? mod;

    if (!globalThis.crypto?.getRandomValues) {
      throw new Error("WebCrypto not available: crypto.getRandomValues is missing");
    }

    const rngBytes = (count: number) => {
      const buf = new Uint8Array(count);
      globalThis.crypto.getRandomValues(buf);
      return bytesToBinaryStringChunked(buf);
    };

    forge.random.getBytesSync = (count: number) => rngBytes(count);
    forge.random.getBytes = (count: number, cb?: ForgeGetBytesCallback) => {
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
  return isSafeGitHubRepoFullName(repo);
}

export { deriveAesKeyBytes, encryptKeystorePayload, encryptWithAesCbcLegacy };

export function bytesToBinaryString(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

export async function encryptText(text: string, masterKey: string): Promise<string> {
  return encryptWithAesCbcLegacy(text, masterKey);
}

export async function ensureBucketExists(
  supabase: StorageBucketsQuery & { storage: { createBucket: (bucket: string, options: { public: boolean; fileSizeLimit: string }) => Promise<{ error?: { message?: string } | null }> } },
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
    const { error } = await supabase
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
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`Could not ensure storage bucket '${bucket}': ${message}`);
  }
}
