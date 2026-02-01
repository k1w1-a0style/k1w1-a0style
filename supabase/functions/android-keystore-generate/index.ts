// supabase/functions/android-keystore-generate/index.ts
// Generates an Android keystore server-side, stores it encrypted in Supabase Storage,
// and persists metadata in the `signing_android` table.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "https://esm.sh/node-forge@1.3.1";

import { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { rateLimit, requireAdminKey } from "../_shared/auth.ts";

type Mode = "development" | "preview" | "production";

function safeString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function repoOk(repo: string): boolean {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo);
}

async function deriveAesKeyBytes(masterKey: string): Promise<Uint8Array> {
  // Derive a stable 32-byte key from any masterKey string using SHA-256.
  const input = new TextEncoder().encode(masterKey);
  const hash = await crypto.subtle.digest("SHA-256", input);
  return new Uint8Array(hash); // 32 bytes
}

function bytesToBinaryString(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

async function encryptWithAesCbc(payload: string, masterKey: string): Promise<string> {
  const keyBytes = await deriveAesKeyBytes(masterKey);
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
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

async function ensureBucketExists(
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

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const rl = rateLimit(req, "android-keystore-generate", 30, 60_000);
  if (rl) return rl;
  const auth = requireAdminKey(req);
  if (auth) return auth;

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
    const branch = safeString(body?.branch) || "main";
    const mode = (safeString(body?.mode) as Mode) || "production";

    if (!repoOk(repo)) {
      return errorResponse("Invalid repo format. Expected 'owner/name'.", req, 400);
    }
    if (!/^[A-Za-z0-9_./-]{1,128}$/.test(branch)) {
      return errorResponse("Invalid branch.", req, 400);
    }
    if (!(["development", "preview", "production"] as string[]).includes(mode)) {
      return errorResponse("Invalid mode. Expected development|preview|production.", req, 400);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const bucket = "signing";
    await ensureBucketExists(supabase, bucket);

    // Create keystore
    const alias = "upload";
    const keystorePassword = forge.util.bytesToHex(forge.random.getBytesSync(16));
    const keyPassword = forge.util.bytesToHex(forge.random.getBytesSync(16));

    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = String(Date.now());
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 25);
    const attrs = [{ name: "commonName", value: "k1w1" }];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([{ name: "basicConstraints", cA: true }]);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
      keys.privateKey,
      [cert],
      keystorePassword,
      {
        algorithm: "3des",
        friendlyName: alias,
        generateLocalKeyId: true,
      },
    );

    const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
    const p12Uint8 = new Uint8Array(p12Der.length);
    for (let i = 0; i < p12Der.length; i++) p12Uint8[i] = p12Der.charCodeAt(i);

    // Encrypt payload (includes raw keystore + passwords)
    const payload = JSON.stringify({
      keystoreBase64: btoa(bytesToBinaryString(p12Uint8)),
      keystorePassword,
      keyPassword,
      alias,
    });
    const encrypted = await encryptWithAesCbc(payload, masterKey);

    const storagePath = `android/${repo.replace("/", "__")}/${branch}/keystore.enc`;
    const { error: uploadErr } = await supabase.storage
      .from(bucket)
      .upload(storagePath, new Blob([encrypted], { type: "text/plain" }), {
        upsert: true,
        contentType: "text/plain",
      });
    if (uploadErr) {
      return errorResponse("Storage upload failed", req, 500, { message: uploadErr.message });
    }

    const now = new Date().toISOString();
    const { error: dbErr } = await supabase
      .from("signing_android")
      .upsert(
        {
          repo,
          alias,
          storage_bucket: bucket,
          storage_path: storagePath,
          mode,
          updated_at: now,
        },
        { onConflict: "repo" },
      );
    if (dbErr) {
      return errorResponse("DB upsert failed", req, 500, { message: dbErr.message });
    }

    return jsonResponse(
      {
        ok: true,
        repo,
        branch,
        mode,
        alias,
        bucket,
        path: storagePath,
      },
      req,
    );
  } catch (e) {
    return errorResponse("Unhandled error", req, 500, { message: e?.message || String(e) });
  }
});
