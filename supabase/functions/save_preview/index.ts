import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { requireAdminKey, rateLimit } from "../_shared/auth.ts";
import { parseJsonBody } from "../_shared/validation.ts";

type SnackFiles = Record<string, { type?: string; contents: string }>;
type Payload = {
  projectId?: string;
  name?: string;
  files: SnackFiles;
  dependencies?: Record<string, string>;
  meta?: Record<string, unknown>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sanitizePath(raw: string): string | null {
  let p = String(raw ?? "")
    .trim()
    .replace(/\\/g, "/");
  if (!p) return null;
  if (p.length > 300) return null;
  if (p.includes("\0")) return null;

  const segs = p.split("/").filter(Boolean);
  if (segs.some((s) => s === "..")) return null;

  p = p.replace(/\/+/g, "/");
  if (!p.startsWith("/")) p = "/" + p;
  return p;
}

function sanitizeFiles(files: SnackFiles): SnackFiles {
  const out: SnackFiles = {};
  let total = 0;
  let count = 0;

  for (const [rawPath, val] of Object.entries(files)) {
    count++;
    if (count > 250) throw new Error("Too many files");

    const key = sanitizePath(rawPath);
    if (!key) continue;

    const contents = String((val as any)?.contents ?? "");
    total += contents.length;
    if (total > 1_500_000) throw new Error("Payload too large");

    out[key] = { type: (val as any)?.type, contents };
  }

  if (!Object.keys(out).length) throw new Error("No valid files");
  return out;
}

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-k1w1-admin-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(res: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(res), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

function randomSecret(lenBytes = 24): string {
  const bytes = new Uint8Array(lenBytes);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function approxSize(obj: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(obj)).length;
  } catch {
    return 0;
  }
}

serve(async (req) => {
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
  const parsed = await parseJsonBody(req, 2_000_000);
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

  const bytes = approxSize(body);
  if (bytes > 1_500_000) {
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
    console.error("[save_preview] error:", e);
    return json(
      { ok: false, error: "Internal Server Error" },
      { status: 500, headers: cors },
    );
  }
});
