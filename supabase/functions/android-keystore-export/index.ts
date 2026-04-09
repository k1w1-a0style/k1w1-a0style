import {
  createClient,
  decryptKeystorePayload,
  errorResponse,
  getJwtPayload,
  getServiceRoleKey,
  getSigningMasterKey,
  getSupabaseUrl,
  handleCors,
  jsonResponse,
  rateLimit,
  getRequestClientIp, getRequestRateLimitSubject,
  requireDurableRateLimit,
  repoOk,
  requireJwtRole,
  requireScopedEdgeAuth,
  resolveMode,
  safeString,
} from "./helpers.ts";
import { isParsedJsonBodyError, parseJsonBody } from "../_shared/validation.ts";
import { sanitizeErrorText } from "../_shared/errorSanitization.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Scoped route auth replaces the former shared admin/service-role guard.
  const auth = requireScopedEdgeAuth(req, {
    scope: "android-keystore-export",
    allowAdmin: true,
    allowJwtAuthHeaderWithAdmin: true,
    adminSecretEnv: "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY",
  });
  if (auth) return auth;
  const jwtRoleGuard = await requireJwtRole(req, {
    scope: "android-keystore-export",
    allowedRoles: ["service_role"],
  });
  if (jwtRoleGuard) return jwtRoleGuard;

  const durableRl = await requireDurableRateLimit(req, {
    scope: "android-keystore-export",
    subject: getRequestRateLimitSubject(req),
    max: 30,
    windowMs: 60_000,
    enforceDurable: true,
  });
  if (durableRl) return durableRl;

  const rl = rateLimit(req, "android-keystore-export", 30, 60_000);
  if (rl) return rl;

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

    const parsedBody = await parseJsonBody(req, 20_000);
    if (isParsedJsonBodyError(parsedBody)) {
      const status = parsedBody.error.toLowerCase().includes("too large") ? 413 : 400;
      return errorResponse(status === 413 ? "Request too large" : "Invalid JSON body", req, status);
    }
    const body = parsedBody.body;
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
      return errorResponse("DB read failed", req, 500);
    }
    if (!data) return errorResponse("No signing record for repo", req, 404, { repo });

    const bucket = String(data.storage_bucket || "").trim();
    const path = String(data.storage_path || "").trim();
    if (!bucket || !path) {
      return errorResponse("Invalid signing record (missing bucket/path)", req, 500);
    }

    const { data: file, error: dlErr } = await supabase.storage.from(bucket).download(path);
    if (dlErr || !file) {
      return errorResponse("Storage download failed", req, 500);
    }

    const encrypted = await file.text();
    const decrypted = await decryptKeystorePayload(encrypted, masterKey);
    const parsed = JSON.parse(decrypted);

    try {
      const payload = getJwtPayload(req);
      const actor = typeof payload?.sub === "string" ? payload.sub : "service_role";
      const ip = getRequestClientIp(req);
      const userAgent = req.headers.get("user-agent") || "";
      const { error: auditError } = await supabase.from("signing_audit_log").insert({
        repo,
        mode: resolvedMode,
        action: "export",
        actor,
        ip,
        user_agent: userAgent,
      });
      if (auditError) {
        return errorResponse("Audit log write failed", req, 503);
      }
    } catch {
      return errorResponse("Audit log write failed", req, 503);
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
    const safeMessage = sanitizeErrorText(e instanceof Error ? e.message : String(e));
    return errorResponse("Unhandled error", req, 500, {
      message: safeMessage,
    });
  }
});
