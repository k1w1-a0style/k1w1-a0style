// supabase/functions/android-keystore-generate/index.ts
// Generates an Android signing keystore (PKCS12) and stores it in Supabase Storage.
//
// NOTE:
// - Runs on Supabase Edge Functions (Deno).
// - Uses PKCS12 (.p12) because we can generate it purely in JS.
// - The CI workflow will fetch the file and generate credentials.json for EAS (production builds).
//
// Env required:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - SIGNING_MASTER_KEY (32+ bytes string, used for AES-GCM to encrypt passwords)
// - SIGNING_BUCKET (optional, default: "signing")

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "https://esm.sh/node-forge@1.3.1";

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });
}

function randomPassword(len = 24) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%_-";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("");
}

async function encrypt(secret: string, plaintext: string) {
  // AES-GCM with random IV, output base64(iv).base64(ciphertext)
  const enc = new TextEncoder();
  const keyData = enc.encode(secret.padEnd(32, "0").slice(0, 32));
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    "AES-GCM",
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );

  const b64 = (buf: ArrayBuffer | Uint8Array) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)));

  return `${b64(iv)}.${b64(ct)}`;
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const masterKey = Deno.env.get("SIGNING_MASTER_KEY");
    const bucket = Deno.env.get("SIGNING_BUCKET") || "signing";

    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
    }
    if (!masterKey || masterKey.length < 16) {
      return json({ error: "Missing/weak SIGNING_MASTER_KEY" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const repo = String(body?.repo || "").trim(); // "owner/name"
    const mode = String(body?.mode || "production").trim(); // development|preview|production

    if (!repo || !repo.includes("/")) {
      return json({ error: "Invalid repo format. Expected 'owner/name'." }, { status: 400 });
    }

    const alias = `k1w1-${repo.replace("/", "-")}`;
    const keystorePassword = randomPassword(28);
    const keyPassword = randomPassword(28);

    // Generate RSA keypair + certificate
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = String(Date.now());
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 30);

    const attrs = [
      { name: "commonName", value: repo },
      { name: "organizationName", value: "k1w1" },
      { name: "countryName", value: "DE" },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    // PKCS12 container (.p12)
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
      keys.privateKey,
      cert,
      keystorePassword,
      { algorithm: "3des", friendlyName: alias }
    );
    const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
    const p12Bytes = new Uint8Array(p12Der.length);
    for (let i = 0; i < p12Der.length; i++) p12Bytes[i] = p12Der.charCodeAt(i);

    const storagePath = `${repo}/android/${alias}.p12`;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Upload (upsert)
    const uploadRes = await supabase.storage
      .from(bucket)
      .upload(storagePath, p12Bytes, {
        upsert: true,
        contentType: "application/x-pkcs12",
      });

    if (uploadRes.error) {
      return json({ error: uploadRes.error.message }, { status: 500 });
    }

    // Encrypt passwords before storing
    const encKs = await encrypt(masterKey, keystorePassword);
    const encKey = await encrypt(masterKey, keyPassword);

    // Store metadata in table (best effort)
    const upsert = await supabase
      .from("signing_android")
      .upsert(
        {
          repo,
          alias,
          storage_bucket: bucket,
          storage_path: storagePath,
          keystore_password_enc: encKs,
          key_password_enc: encKey,
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          mode,
        },
        { onConflict: "repo" }
      );

    if (upsert.error) {
      // Don't fail generation if DB insert fails; storage is the most important piece.
      console.warn("DB upsert error:", upsert.error.message);
    }

    return json({
      ok: true,
      repo,
      mode,
      alias,
      storageBucket: bucket,
      storagePath,
      // DO NOT return raw passwords
    });
  } catch (e) {
    return json({ error: e?.message || String(e) }, { status: 500 });
  }
});
