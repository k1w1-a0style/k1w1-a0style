import {
  createClient,
  decryptKeystorePayloadWithMigration,
  errorResponse,
  getServiceRoleKey,
  getSigningMasterKey,
  getSupabaseUrl,
  handleCors,
  jsonResponse,
  rateLimit,
  getRequestClientIp, getRequestRateLimitSubject,
  isAllowedGithubRepo,
  requireDurableRateLimit,
  repoOk,
  requireServiceRoleJwtWithVerifiedActor,
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
    adminSecretEnv: "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY",
  });
  if (auth) return auth;
  const jwtActorGuard = await requireServiceRoleJwtWithVerifiedActor(req, "android-keystore-export");
  if (jwtActorGuard.guard) return jwtActorGuard.guard;
  const rateLimitSubject = getRequestRateLimitSubject(req, jwtActorGuard.actor);

  const durableRl = await requireDurableRateLimit(req, {
    scope: "android-keystore-export",
    subject: rateLimitSubject,
    max: 30,
    windowMs: 60_000,
    enforceDurable: true,
  });
  if (durableRl) return durableRl;

  const rl = rateLimit(req, "android-keystore-export", 30, 60_000, rateLimitSubject);
  if (rl) return rl;

  try {
    const secureError = (message: string, status: number, details?: unknown) =>
      errorResponse(message, req, status, details, { noStore: true });
    const secureJson = (body: unknown, status = 200) =>
      jsonResponse(body, req, status, { noStore: true });

    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getServiceRoleKey(req);
    const masterKey = getSigningMasterKey();

    if (!supabaseUrl || !serviceKey) {
      return secureError(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
        500,
      );
    }
    if (!masterKey || masterKey.trim().length < 24) {
      return secureError(
        "Missing SIGNING_MASTER_KEY (must be set as Supabase Edge Secret)",
        500,
      );
    }

    const parsedBody = await parseJsonBody(req, 20_000);
    if (isParsedJsonBodyError(parsedBody)) {
      const status = parsedBody.error.toLowerCase().includes("too large") ? 413 : 400;
      return secureError(status === 413 ? "Request too large" : "Invalid JSON body", status);
    }
    const body = parsedBody.body;
    const repo = safeString(body?.repo);

    if (!repoOk(repo)) {
      return secureError(
        "Invalid repo format. Expected 'owner/name'.",
        400,
      );
    }
    if (!isAllowedGithubRepo(repo)) {
      const denyRepo = () => {
        return errorResponse("Repo not allowed", req, 403, { repo });
      };
      const denied = denyRepo();
      denied.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      denied.headers.set("Pragma", "no-cache");
      denied.headers.set("Expires", "0");
      return denied;
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
      return secureError("DB read failed", 500);
    }
    if (!data) return secureError("No signing record for repo", 404, { repo });

    const bucket = String(data.storage_bucket || "").trim();
    const path = String(data.storage_path || "").trim();
    if (!bucket || !path) {
      return secureError("Invalid signing record (missing bucket/path)", 500);
    }

    const { data: file, error: dlErr } = await supabase.storage.from(bucket).download(path);
    if (dlErr || !file) {
      return secureError("Storage download failed", 500);
    }

    const encrypted = await file.text();
    const decrypted = await decryptKeystorePayloadWithMigration(encrypted, masterKey, async (migratedV3Payload) => {
      const { error: migrationWriteError } = await supabase.storage.from(bucket).upload(path, migratedV3Payload, {
        upsert: true,
        contentType: "text/plain",
      });
      if (migrationWriteError) {
        throw migrationWriteError;
      }
    });
    let parsed: {
      alias: string;
      keystoreBase64: string;
      keystorePassword: string;
      keyPassword: string;
    };
    {
      let raw: unknown;
      try {
        raw = JSON.parse(decrypted);
      } catch {
        return secureError("Decrypted keystore payload is not valid JSON", 500);
      }
      if (
        !raw ||
        typeof raw !== "object" ||
        typeof (raw as { alias?: unknown }).alias !== "string" ||
        typeof (raw as { keystoreBase64?: unknown }).keystoreBase64 !== "string" ||
        typeof (raw as { keystorePassword?: unknown }).keystorePassword !== "string" ||
        typeof (raw as { keyPassword?: unknown }).keyPassword !== "string"
      ) {
        return secureError("Decrypted keystore payload has unexpected shape", 500);
      }
      parsed = raw as typeof parsed;
    }

    try {
      const actor = jwtActorGuard.actor ?? "service_role";
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
        return secureError("Audit log write failed", 503);
      }
    } catch {
      return secureError("Audit log write failed", 503);
    }

    return secureJson(
      {
        ok: true,
        repo,
        alias: parsed.alias,
        keystoreBase64: parsed.keystoreBase64,
        keystorePassword: parsed.keystorePassword,
        keyPassword: parsed.keyPassword,
      },
    );
  } catch (e) {
    const safeDebugMessage = sanitizeErrorText(e instanceof Error ? e.message : String(e));
    console.error("android-keystore-export unhandled error", { message: safeDebugMessage });
    return errorResponse("Unhandled error", req, 500, { code: "internal_error" }, {
      noStore: true,
    });
  }
});
