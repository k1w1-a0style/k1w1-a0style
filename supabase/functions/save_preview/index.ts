import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

type SnackFiles = Record<string, { type?: string; contents: string }>;
type Payload = {
  projectId?: string;
  name?: string;
  files: SnackFiles;
  dependencies?: Record<string, string>;
  meta?: Record<string, unknown>;
};

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
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

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

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
  try {
    body = (await req.json()) as Payload;
  } catch {
    return json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400, headers: cors },
    );
  }

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

  const bytes = approxSize(body);
  if (bytes > 3_000_000) {
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
      project_id: body.projectId ? String(body.projectId).slice(0, 120) : null,
      files: body.files,
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
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: msg }, { status: 500, headers: cors });
  }
});
