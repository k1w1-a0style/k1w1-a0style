// supabase/functions/android-keystore-status/index.ts
// Returns whether a signing record exists for the repo and (best-effort) whether
// the encrypted blob exists in Storage.

import {
  createClient,
  errorResponse,
  getRequestRateLimitSubject,
  getServiceRoleKey,
  getSupabaseUrl,
  handleCors,
  jsonResponse,
  isAllowedGithubRepo,
  rateLimit,
  requireDurableRateLimit,
  repoOk,
  requireScopedEdgeAuth,
  resolveMode,
  resolveVerifiedJwtActor,
  safeString,
} from "./helpers.ts";
import { sanitizeErrorText } from "../_shared/errorSanitization.ts";
import { isParsedJsonBodyError, parseJsonBody } from "../_shared/validation.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const auth = requireScopedEdgeAuth(req, {
    scope: "android-keystore-status",
    allowAdmin: true,
    adminSecretEnv: "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY",
  });
  if (auth) return auth;

  // The local keystore-admin key is the scoped operator secret for this route.
  // A verified JWT is useful for rate-limit attribution, but not required after the
  // scoped admin key has already passed timing-safe validation.
  const verifiedActor = await resolveVerifiedJwtActor(req, "scoped_admin");
  const rateLimitSubject = getRequestRateLimitSubject(req, verifiedActor.actor);

  const durableRl = await requireDurableRateLimit(req, {
    scope: "android-keystore-status",
    subject: rateLimitSubject,
    max: 60,
    windowMs: 60_000,
    enforceDurable: true,
  });
  if (durableRl) return durableRl;

  const rl = rateLimit(req, "android-keystore-status", 60, 60_000, rateLimitSubject);
  if (rl) return rl;

  try {
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getServiceRoleKey(req);
    if (!supabaseUrl || !serviceKey) {
      return errorResponse("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", req, 500);
    }

    const parsedBody = await parseJsonBody(req, 20_000);
    if (isParsedJsonBodyError(parsedBody)) {
      const status = parsedBody.error.toLowerCase().includes("too large") ? 413 : 400;
      return errorResponse(status === 413 ? "Request too large" : "Invalid JSON body", req, status);
    }
    const body = parsedBody.body;
    const repo = safeString(body?.repo);
    if (!repoOk(repo)) {
      return errorResponse("Invalid repo format. Expected 'owner/name'.", req, 400);
    }
    if (!isAllowedGithubRepo(repo)) {
      return errorResponse("Repo not allowed", req, 403, { repo });
    }
    const resolvedMode = resolveMode(body?.mode);

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data, error } = await supabase
      .from("signing_android")
      .select("repo, alias, storage_bucket, storage_path, mode, updated_at")
      .eq("repo", repo).eq("mode", resolvedMode)
      .maybeSingle();

    if (error) return errorResponse("DB read failed", req, 500, { message: error.message });
    if (!data) {
      return jsonResponse({ ok: true, repo, exists: false }, req);
    }

    const bucket = String(data.storage_bucket || "").trim();
    const path = String(data.storage_path || "").trim();

    let storageExists: boolean | null = null;
    if (bucket && path) {
      // Best-effort check: list folder and see if object exists.
      try {
        const folder = path.split("/").slice(0, -1).join("/");
        const file = path.split("/").slice(-1)[0];
        const { data: objects, error: listErr } = await supabase.storage
          .from(bucket)
          .list(folder, { limit: 100, offset: 0 });
        if (!listErr && Array.isArray(objects)) {
          storageExists = objects.some((o) => o?.name === file);
        }
      } catch {
        storageExists = null;
      }
    }

    return jsonResponse(
      {
        ok: true,
        repo,
        exists: true,
        record: {
          alias: data.alias,
          mode: data.mode,
          updatedAt: data.updated_at,
          storage: { bucket, path, exists: storageExists },
        },
      },
      req,
    );
  } catch (e: unknown) {
    const safeDebugMessage = sanitizeErrorText(e instanceof Error ? e.message : String(e));
    console.error("android-keystore-status unhandled error", { message: safeDebugMessage });
    return errorResponse("Unhandled error", req, 500, { code: "internal_error" });
  }
});
