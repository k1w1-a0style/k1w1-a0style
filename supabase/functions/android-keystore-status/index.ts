// supabase/functions/android-keystore-status/index.ts
// Returns whether a signing record exists for the repo and (best-effort) whether
// the encrypted blob exists in Storage.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { rateLimit, requireAdminKey, getServiceRoleKey } from "../_shared/auth.ts";

type Mode = "development" | "preview" | "production";

function resolveMode(v: unknown): Mode {
  const s = typeof v === "string" ? v.trim() : "";
  const lower = s.toLowerCase();
  if (lower === "dev") return "development";
  if (lower === "development" || lower === "preview" || lower === "production") return lower as Mode;
  return "production";
}


function safeString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function repoOk(repo: string): boolean {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo);
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const rl = rateLimit(req, "android-keystore-status", 60, 60_000);
  if (rl) return rl;

  const admin = requireAdminKey(req);
  if (admin) return admin;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = getServiceRoleKey(req);
    if (!supabaseUrl || !serviceKey) {
      return errorResponse("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", req, 500);
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
  } catch (e) {
    return errorResponse("Unhandled error", req, 500, { message: e?.message || String(e) });
  }
});
