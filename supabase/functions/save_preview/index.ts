// supabase/functions/save_preview/index.ts
// REFACTORED: helpers → helpers.ts

import { createClient } from "@supabase/supabase-js";
import { requireAdminKey, rateLimit } from "../_shared/auth.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import { sanitizeErrorText } from "../_shared/errorSanitization.ts";
import {
  SnackFiles,
  Payload,
  UUID_RE,
  sanitizeFiles,
  corsHeaders,
  json,
  randomSecret,
  approxSize,
  MAX_FILES_COUNT,
  MAX_PAYLOAD_BYTES,
} from "./helpers.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const auth = requireAdminKey(req);
  if (auth) return auth;

  const rl = rateLimit(req, "save_preview");
  if (rl) return rl;

  if (req.method !== "POST") {
    return json(
      { ok: false, error: "Method not allowed" },
      { status: 405, headers: cors },
    );
  }

  const PREVIEW_SUPABASE_URL = Deno.env.get("PREVIEW_SUPABASE_URL") ?? "";
  const PREVIEW_SERVICE_ROLE_KEY =
    Deno.env.get("PREVIEW_SERVICE_ROLE_KEY") ?? "";

  if (!PREVIEW_SUPABASE_URL || !PREVIEW_SERVICE_ROLE_KEY) {
    return json(
      {
        ok: false,
        error: "Server misconfigured",
        hint: "Missing PREVIEW_SUPABASE_URL / PREVIEW_SERVICE_ROLE_KEY",
      },
      { status: 500, headers: cors },
    );
  }

  let body: Payload;
  const parsed = await parseJsonBody(req, MAX_PAYLOAD_BYTES);
  if (!parsed.ok) {
    const status = parsed.error.toLowerCase().includes("too large") ? 413 : 400;
    return json({ ok: false, error: parsed.error }, { status, headers: cors });
  }
  body = parsed.body as Payload;

  if (
    !body?.files ||
    typeof body.files !== "object" ||
    Object.keys(body.files).length === 0
  ) {
    return json(
      { ok: false, error: "files fehlt/leer" },
      { status: 400, headers: cors },
    );
  }

  let files: SnackFiles;
  try {
    files = sanitizeFiles(body.files);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid files";
    return json({ ok: false, error: msg }, { status: 400, headers: cors });
  }

  const project_id =
    body.projectId && UUID_RE.test(String(body.projectId))
      ? String(body.projectId)
      : null;

  const fileCount = Object.keys(body.files).length;
  if (fileCount > MAX_FILES_COUNT) {
    return json(
      { ok: false, error: `Too many files (${fileCount} > ${MAX_FILES_COUNT})` },
      { status: 413, headers: cors },
    );
  }

  const bytes = approxSize(body);
  if (bytes > MAX_PAYLOAD_BYTES) {
    return json(
      { ok: false, error: `Payload zu groß (${bytes} bytes)` },
      { status: 413, headers: cors },
    );
  }

  const secret = randomSecret(24);

  const supabase = createClient(
    PREVIEW_SUPABASE_URL,
    PREVIEW_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false },
    },
  );

  try {
    const insertRow = {
      secret,
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

    const previewUrl = `${PREVIEW_SUPABASE_URL}/functions/v1/preview_page?secret=${encodeURIComponent(secret)}`;

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
    return json(
      { ok: false, error: "Internal Server Error" },
      { status: 500, headers: cors },
    );
  }
});
