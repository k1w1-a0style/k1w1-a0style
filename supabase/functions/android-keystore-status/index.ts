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
  rateLimit,
  requireDurableRateLimit,
  repoOk,
  requirePrivilegedOperatorJwtRole,
  requireScopedEdgeAuth,
  resolveMode,
  safeString,
} from "./helpers.ts";
import { isParsedJsonBodyError, parseJsonBody } from "../_shared/validation.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const auth = requireScopedEdgeAuth(req, {
    scope: "android-keystore-status",
    allowAdmin: true,
    allowJwtAuthHeaderWithAdmin: true,
    adminSecretEnv: "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY",
  });
  if (auth) return auth;
  const jwtRoleGuard = await requirePrivilegedOperatorJwtRole(req, "android-keystore-status");
  if (jwtRoleGuard) return jwtRoleGuard;

  const durableRl = await requireDurableRateLimit(req, {
    scope: "android-keystore-status",
    subject: getRequestRateLimitSubject(req),
    max: 60,
    windowMs: 60_000,
  });
  if (durableRl) return durableRl;

  const rl = rateLimit(req, "android-keystore-status", 60, 60_000);
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
    return errorResponse("Unhandled error", req, 500, {
      message: e instanceof Error ? e.message : String(e),
    });
  }
});
