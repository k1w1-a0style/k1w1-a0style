// supabase/functions/android-keystore-export/index.ts
// REFACTORED: helpers → helpers.ts

import { Mode,resolveMode,safeString,repoOk,base64UrlToString,getJwtRole,getJwtSub,deriveAesKeyBytes,binaryStringToBytes,decryptWithAesCbc } from "./helpers.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const rl = rateLimit(req, "android-keystore-export", 30, 60_000);
  if (rl) return rl;

  // CI path: allow service_role JWT WITHOUT admin key
  const role = getJwtRole(req);
  if (role === "service_role") {
    // ok
  } else {
    // Dev / manual path: require admin key (if configured)
    const admin = requireAdminKey(req);
    if (admin) return admin;

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
    const serviceKey = getServiceRoleKey(req);
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
    const resolvedMode = resolveMode(body?.mode);


    const supabase = createClient(supabaseUrl, serviceKey);

    const { data, error } = await supabase
      .from("signing_android")
      .select("repo, alias, storage_bucket, storage_path")
      .eq("repo", repo).eq("mode", resolvedMode)
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
        // Best-effort audit logging (do not leak secrets without leaving a trace).
    try {
      const actor = getJwtSub(req) || "service_role";
      const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "").split(",")[0].trim();
      const userAgent = req.headers.get("user-agent") || "";
      await supabase.from("signing_audit_log").insert({
        repo,
        mode: resolvedMode,
        action: "export",
        actor,
        ip,
        user_agent: userAgent,
      });
    } catch {
      // ignore audit failures to avoid breaking CI, but keep server logs.
      console.warn("[signing_audit_log] insert failed");
    }

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
