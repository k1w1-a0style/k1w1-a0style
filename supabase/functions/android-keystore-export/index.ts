import {
  createClient,
  decryptWithAesCbc,
  errorResponse,
  getJwtSub,
  getServiceRoleKey,
  getSigningMasterKey,
  getSupabaseUrl,
  handleCors,
  jsonResponse,
  rateLimit,
  repoOk,
  requireScopedEdgeAuth,
  resolveMode,
  safeString,
} from "./helpers.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const rl = rateLimit(req, "android-keystore-export", 30, 60_000);
  if (rl) return rl;

  // Scoped route auth replaces the former shared admin/service-role guard.
  const auth = requireScopedEdgeAuth(req, {
    scope: "android-keystore-export",
    allowAdmin: true,
    allowCiBearer: false,
    adminSecretEnv: "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY",
  });
  if (auth) return auth;

  try {
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getServiceRoleKey(req);
    const masterKey = getSigningMasterKey();

    if (!supabaseUrl || !serviceKey) {
      return errorResponse(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
        req,
        500,
      );
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
      return errorResponse(
        "Invalid repo format. Expected 'owner/name'.",
        req,
        400,
      );
    }
    const resolvedMode = resolveMode(body?.mode);

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data, error } = await supabase
      .from("signing_android")
      .select("repo, alias, storage_bucket, storage_path")
      .eq("repo", repo)
      .eq("mode", resolvedMode)
      .maybeSingle();

    if (error) {
      return errorResponse("DB read failed", req, 500, { message: error.message });
    }
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

    try {
      const actor = getJwtSub(req) || "service_role";
      const ip = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "")
        .split(",")[0]
        .trim();
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
    return errorResponse("Unhandled error", req, 500, {
      message: e instanceof Error ? e.message : String(e),
    });
  }
});
