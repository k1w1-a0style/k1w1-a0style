// supabase/functions/android-keystore-generate/index.ts
// REFACTORED: helpers → helpers.ts

import {
  resolveMode, getForge, safeString, repoOk,
  bytesToBinaryStringChunked, encryptText, ensureBucketExists,
  bytesToBinaryString, createClient, encryptKeystorePayload,
  errorResponse, getServiceRoleKey, getSigningMasterKey, getSupabaseUrl, handleCors, jsonResponse, rateLimit, requireAdminKey, requireDurableRateLimit,
} from "./helpers.ts";
import type { Mode } from "./helpers.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const auth = requireAdminKey(req);
  if (auth) return auth;

  const durableRl = await requireDurableRateLimit(req, {
    scope: "android-keystore-generate",
    subject: req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown",
    max: 30,
    windowMs: 60_000,
  });
  if (durableRl) return durableRl;
  const rl = rateLimit(req, "android-keystore-generate", 30, 60_000);
  if (rl) return rl;
  try {
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getServiceRoleKey(req);
    const masterKey = getSigningMasterKey();

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
    let mode: Mode;
    try {
      mode = resolveMode(safeString(body?.mode));
    } catch (e) {
      return errorResponse(e?.message || "Invalid mode.", req, 400);
    }

    if (!repoOk(repo)) {
      return errorResponse("Invalid repo format. Expected 'owner/name'.", req, 400);
    }
    if (!/^[A-Za-z0-9_./-]{1,128}$/.test(branch)) {
      return errorResponse("Invalid branch.", req, 400);
    }
    // `resolveMode` already normalizes/validates.

    const supabase = createClient(supabaseUrl, serviceKey);

    const bucket = "signing";
    await ensureBucketExists(supabase, bucket);

    // Lazy-load forge (gives us real error output instead of BOOT_ERROR)
    const forge = await getForge();


    // Create keystore
    const alias = "upload";
    const keystorePassword = forge.util.bytesToHex(forge.random.getBytesSync(16));
    const keyPassword = forge.util.bytesToHex(forge.random.getBytesSync(16));

      // RSA generation in pure JS (forge) is slow and can hit Edge timeouts.
  // Use WebCrypto (native) and convert to forge keys for certificate + PKCS#12.
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  );

  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", keyPair.privateKey));
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", keyPair.publicKey));

  const u8ToBinary = (u8: Uint8Array) => {
    let s = "";
    for (let i = 0; i < u8.length; i += 0x8000) {
      s += String.fromCharCode(...u8.slice(i, i + 0x8000));
    }
    return s;
  };

  const privateKey = forge.pki.privateKeyFromAsn1(forge.asn1.fromDer(u8ToBinary(pkcs8)));
  const publicKey = forge.pki.publicKeyFromAsn1(forge.asn1.fromDer(u8ToBinary(spki)));

  const cert = forge.pki.createCertificate();
  cert.publicKey = publicKey;
  cert.serialNumber = String(Math.floor(Math.random() * 1e16));
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 25);

  const attrs = [{ name: "commonName", value: alias }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  cert.setExtensions([
    { name: "basicConstraints", cA: true },
    { name: "keyUsage", keyCertSign: true, digitalSignature: true, nonRepudiation: true, keyEncipherment: true },
    { name: "subjectKeyIdentifier" },
  ]);

  cert.sign(privateKey, forge.md.sha256.create());

    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
      privateKey,
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
    const encrypted = await encryptKeystorePayload(payload, masterKey);

    const storagePath = `android/${repo.replace("/", "__")}/${mode}/keystore.enc`;
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
          // Backward-compat: earlier schema had NOT NULL password columns.
          // We don't rely on them (source of truth is the encrypted blob in Storage),
          // but we fill them so inserts never fail.
          keystore_password_enc: await encryptText(keystorePassword, masterKey),
          key_password_enc: await encryptText(keyPassword, masterKey),
          mode,
          updated_at: now,
        },
        { onConflict: "repo,mode" },
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
