// supabase/functions/save_preview/index.ts
// REFACTORED: helpers → helpers.ts

import { createClient } from "@supabase/supabase-js";
import {
  getPreviewServiceRoleKey,
  getPreviewSupabaseUrl,
  getRequestRateLimitSubject,
  requireDurableRateLimit,
  requireVerifiedJwt,
  rateLimit,
} from "../_shared/auth.ts";
import { isParsedJsonBodyError, parseJsonBody } from "../_shared/validation.ts";
import { sanitizeErrorText } from "../_shared/errorSanitization.ts";
import {
  SnackFiles,
  Payload,
  UUID_RE,
  sanitizeFiles,
  corsHeaders,
  json,
  jsonPreviewError,
  randomSecret,
  approxSize,
  MAX_FILES_COUNT,
  MAX_PAYLOAD_BYTES,
  classifySavePreviewPayloadError,
  classifySavePreviewUnexpectedError,
  hashPreviewSecret,
} from "./helpers.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const auth = await requireVerifiedJwt(req, "save_preview");
  if (auth) return auth;

  const durableRl = await requireDurableRateLimit(req, {
    scope: "save_preview",
    subject: getRequestRateLimitSubject(req),
    max: 60,
    windowMs: 60_000,
    enforceDurable: true,
  });
  if (durableRl) return durableRl;

  const rl = rateLimit(req, "save_preview");
  if (rl) return rl;

  if (req.method !== "POST") {
    return json(
      { ok: false, error: "Method not allowed" },
      { status: 405, headers: cors },
    );
  }

  const previewSupabaseUrl = getPreviewSupabaseUrl() ?? "";
  const previewServiceRoleKey = getPreviewServiceRoleKey() ?? "";

  if (!previewSupabaseUrl || !previewServiceRoleKey) {
    return jsonPreviewError({
      origin,
      code: "preview_env_missing",
    });
  }

  let body: Payload;
  const parsed = await parseJsonBody(req, MAX_PAYLOAD_BYTES);
  if (isParsedJsonBodyError(parsed)) {
    const parseError = parsed.error;
    return jsonPreviewError({
      origin,
      code: classifySavePreviewPayloadError(parseError),
    });
  }
  body = parsed.body as Payload;

  if (
    !body?.files ||
    typeof body.files !== "object" ||
    Object.keys(body.files).length === 0
  ) {
    return jsonPreviewError({
      origin,
      code: "preview_payload_invalid",
      message: "Preview-Payload enthaelt keine Dateien.",
    });
  }

  let files: SnackFiles;
  try {
    files = sanitizeFiles(body.files);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid files";
    return jsonPreviewError({
      origin,
      code: classifySavePreviewPayloadError(msg),
    });
  }

  const project_id =
    body.projectId && UUID_RE.test(String(body.projectId))
      ? String(body.projectId)
      : null;

  const fileCount = Object.keys(body.files).length;
  if (fileCount > MAX_FILES_COUNT) {
    return jsonPreviewError({
      origin,
      code: "preview_payload_too_large",
    });
  }

  const bytes = approxSize(body);
  if (bytes > MAX_PAYLOAD_BYTES) {
    return jsonPreviewError({
      origin,
      code: "preview_payload_too_large",
    });
  }

  const secret = randomSecret(24);

  const supabase = createClient(
    previewSupabaseUrl,
    previewServiceRoleKey,
    {
      auth: { persistSession: false },
    },
  );

  try {
    const storedSecret = await hashPreviewSecret(secret);
    const insertRow = {
      secret: storedSecret,
      name: (body.name ?? "Preview").slice(0, 120),
      project_id,
      files,
      dependencies: body.dependencies ?? {},
      meta: body.meta ?? {},
    };

    const { data, error } = await supabase
      .from("previews")
      .insert(insertRow)
      .select("id, expires_at")
      .single();

    if (error) throw error;

    const previewUrl =
      `${previewSupabaseUrl}/functions/v1/preview_page?transport=fragment` +
      `#secret=${encodeURIComponent(storedSecret)}`;

    return json(
      {
        ok: true,
        previewId: data?.id ?? null,
        previewUrl,
        expiresAt: data?.expires_at ?? null,
      },
      { status: 200, headers: cors },
    );
  } catch (e) {
    const msg = sanitizeErrorText(e instanceof Error ? e.message : String(e));
    console.error("[save_preview] error:", msg);
    return jsonPreviewError({
      origin,
      code: classifySavePreviewUnexpectedError(e),
    });
  }
});
