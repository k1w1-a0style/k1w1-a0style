// supabase/functions/android-keystore-export/index.ts
// Returns the stored Android keystore metadata + decrypted passwords.
// Intended to be used ONLY by CI (service role key).
//
// Env required:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - SIGNING_MASTER_KEY

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });
}

async function decrypt(secret: string, payload: string) {
  const [ivB64, ctB64] = String(payload).split(".");
  if (!ivB64 || !ctB64) throw new Error("Invalid encrypted payload");

  const bin = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  const enc = new TextEncoder();
  const keyData = enc.encode(secret.padEnd(32, "0").slice(0, 32));
  const key = await crypto.subtle.importKey("raw", keyData, "AES-GCM", false, ["decrypt"]);

  const iv = bin(ivB64);
  const ct = bin(ctB64);

  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const masterKey = Deno.env.get("SIGNING_MASTER_KEY");

    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
    }
    if (!masterKey || masterKey.length < 16) {
      return json({ error: "Missing/weak SIGNING_MASTER_KEY" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const repo = String(body?.repo || "").trim();

    if (!repo || !repo.includes("/")) {
      return json({ error: "Invalid repo format. Expected 'owner/name'." }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data, error } = await supabase
      .from("signing_android")
      .select("repo, alias, storage_bucket, storage_path, keystore_password_enc, key_password_enc, created_at, updated_at")
      .eq("repo", repo)
      .maybeSingle();

    if (error) return json({ error: error.message }, { status: 500 });
    if (!data) return json({ exists: false, repo }, { status: 404 });

    const ks = await decrypt(masterKey, data.keystore_password_enc);
    const kp = await decrypt(masterKey, data.key_password_enc);

    return json({
      exists: true,
      repo,
      alias: data.alias,
      bucket: data.storage_bucket,
      path: data.storage_path,
      keystorePassword: ks,
      keyPassword: kp,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  } catch (e) {
    return json({ error: e?.message || String(e) }, { status: 500 });
  }
});
