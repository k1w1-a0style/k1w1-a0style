// supabase/functions/preview_page/index.ts
// Serves a preview page for a previously "saved preview" (by secret).
// NOTE: Preview runs in a sandbox. Do NOT put secrets/service keys into preview files.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type SnackFiles = Record<string, { type?: string; contents: string }>;

type PreviewRecord = {
  name: string;
  secret: string;
  created_at: string;
  expires_at: string;
  project_id?: string | null;
  files: SnackFiles;
  dependencies: Record<string, string> | null;
  meta: Record<string, unknown> | null;
};

const TABLE = "previews";

// Limits
const MAX_FILES_BYTES = 3_000_000; // 3MB (align with save_preview default)
const MAX_RESPONSE_BYTES = 5_000_000; // 5MB safety for generated HTML

// Rate limiting (best-effort, in-memory; resets on cold start)
const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_MAX_REQ = 60; // 60 req/min per IP
const recentRequests = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = recentRequests.get(ip) || [];
  const filtered = arr.filter((t) => now - t < RATE_WINDOW_MS);
  if (filtered.length >= RATE_MAX_REQ) {
    recentRequests.set(ip, filtered);
    return true;
  }
  filtered.push(now);
  recentRequests.set(ip, filtered);
  return false;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getSupabaseBaseUrl(): string {
  // Keep consistent with your save_preview function (uses PREVIEW_SUPABASE_URL)
  return Deno.env.get("PREVIEW_SUPABASE_URL") ?? "";
}

function supabaseHeaders(): Record<string, string> {
  // Keep consistent with your save_preview function (uses PREVIEW_SERVICE_ROLE_KEY)
  const key = Deno.env.get("PREVIEW_SERVICE_ROLE_KEY") ?? "";
  if (!key) throw new Error("Missing PREVIEW_SERVICE_ROLE_KEY");

  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
  };
}

function withTimeout(ms: number) {
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), ms);
  return { signal: ac.signal, cancel: () => clearTimeout(id) };
}

function utf8Size(s: string): number {
  return new TextEncoder().encode(s).length;
}

function approxFilesPayloadSize(files: SnackFiles): number {
  try {
    return utf8Size(JSON.stringify(files));
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function buildCsp(): string {
  // Optional strict CSP test mode: remove unsafe-eval
  const strict =
    (Deno.env.get("TEST_STRICT_CSP") ?? "").toLowerCase() === "true";
  const evalPart = strict ? "" : " 'unsafe-eval'";

  return [
    "default-src 'self' data: blob:",
    "img-src 'self' https: data: blob:",
    "media-src 'self' https: data: blob:",
    "font-src 'self' https: data: blob:",
    "style-src 'self' 'unsafe-inline' https: data: blob:",
    // Keep sources tight; SandpackClient is loaded from esm.sh.
    `script-src 'self' 'unsafe-inline'${evalPart} https://esm.sh data: blob:`,
    "connect-src 'self' https: wss: data: blob:",
    "frame-src 'self' https: data: blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function html(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",

      // Supabase can inject a very strict CSP (default-src 'none'; sandbox),
      // which breaks Sandpack/WebViews (white screen). Override it here.
      "Content-Security-Policy": buildCsp(),
      "Referrer-Policy": "no-referrer",
    },
  });
}

async function fetchPreviewRecord(
  secret: string,
): Promise<PreviewRecord | null> {
  const base = getSupabaseBaseUrl();
  if (!base) return null;

  // ✅ Match your DB schema (migrations + save_preview): files/dependencies/meta (NOT payload)
  const select =
    "name,secret,created_at,expires_at,project_id,files,dependencies,meta";

  const restUrl =
    `${base}/rest/v1/${TABLE}?secret=eq.${encodeURIComponent(secret)}` +
    `&select=${encodeURIComponent(select)}&limit=1`;

  const t = withTimeout(8000);
  try {
    const res = await fetch(restUrl, {
      method: "GET",
      headers: supabaseHeaders(),
      signal: t.signal,
    });

    if (!res.ok) return null;

    const ctype = res.headers.get("content-type") ?? "";
    if (!ctype.toLowerCase().includes("application/json")) {
      console.error("preview_page: unexpected content-type:", ctype);
      return null;
    }

    let arr: unknown = null;
    try {
      arr = await res.json();
    } catch (e) {
      console.error("preview_page: failed to parse JSON:", e);
      return null;
    }

    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr[0] as PreviewRecord;
  } catch (e) {
    console.error("fetchPreviewRecord error:", e);
    return null;
  } finally {
    t.cancel();
  }
}

function isExpired(expiresAtIso: string | null | undefined): boolean {
  if (!expiresAtIso) return false;
  const t = Date.parse(expiresAtIso);
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

function renderPage(params: {
  name: string;
  createdAt: string;
  expiresAt: string;
  files: SnackFiles;
  dependencies?: Record<string, string>;
  template?: string;
}) {
  const { name, createdAt, expiresAt, files, dependencies, template } = params;

  const sandpackSetup = {
    files,
    dependencies: dependencies ?? undefined,
    template: template ?? "react",
  };

  const sandpackJson = JSON.stringify(sandpackSetup);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>${escapeHtml(name)} - Preview</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: 100%; background: #0a0a0a; color: #eee; font-family: system-ui, -apple-system, sans-serif; }
  .header { position: fixed; top: 0; left: 0; right: 0; height: 48px; background: rgba(10, 10, 10, 0.95); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-bottom: 1px solid #222; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; z-index: 9999; }
  .header-left { display: flex; flex-direction: column; gap: 2px; }
  .header-title { font-weight: 600; color: #00ff88; font-size: 15px; }
  .header-meta { font-size: 11px; color: #666; }
  .header-actions { display: flex; gap: 8px; }
  .btn { padding: 6px 12px; background: #1a1a1a; border: 1px solid #333; border-radius: 6px; color: #fff; font-size: 12px; cursor: pointer; transition: all 0.2s; }
  .btn:hover { background: #333; border-color: #444; }
  .btn:active { transform: scale(0.98); }
  .content { position: absolute; top: 48px; left: 0; right: 0; bottom: 0; }
  #root { width: 100%; height: 100%; }
  .overlay { position: absolute; top: 48px; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0a0a0a; transition: opacity 0.3s; }
  .overlay.hidden { opacity: 0; pointer-events: none; }
  .spinner { width: 40px; height: 40px; border: 3px solid #222; border-top-color: #00ff88; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .overlay-text { margin-top: 16px; color: #666; font-size: 14px; }
  .error-overlay { background: #1a0505; }
  .error-title { color: #ff4444; font-size: 18px; font-weight: 600; margin-bottom: 8px; }
  .error-message { color: #ff6b6b; font-size: 14px; max-width: 520px; text-align: center; line-height: 1.5; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; white-space: pre-wrap; word-break: break-word; padding: 0 16px; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="header-title">${escapeHtml(name)}</div>
      <div class="header-meta">
        Created: ${escapeHtml(createdAt)} · Expires: ${escapeHtml(expiresAt)}
      </div>
    </div>
    <div class="header-actions">
      <button class="btn" id="btn-reload">↻ Reload</button>
    </div>
  </div>

  <div class="content">
    <div id="root"></div>
  </div>

  <div class="overlay" id="overlay">
    <div class="spinner"></div>
    <div class="overlay-text">Booting preview…</div>
  </div>

<script type="module">
  const overlay = document.getElementById("overlay");
  const btnReload = document.getElementById("btn-reload");

  const setup = ${sandpackJson};

  import { SandpackClient } from "https://esm.sh/@codesandbox/sandpack-client@2.19.0";

  function hideOverlay() {
    overlay?.classList.add("hidden");
  }

  function showError(err) {
    overlay?.classList.remove("hidden");
    overlay?.classList.add("error-overlay");
    overlay.innerHTML = \`
      <div class="error-title">Preview Error</div>
      <div class="error-message">\${String(err?.stack || err?.message || err)}</div>
    \`;
  }

  async function start() {
    try {
      overlay?.classList.remove("hidden");
      overlay?.classList.remove("error-overlay");
      overlay.innerHTML = \`
        <div class="spinner"></div>
        <div class="overlay-text">Booting preview…</div>
      \`;

      const root = document.getElementById("root");
      if (!root) throw new Error("Missing #root container");
      root.innerHTML = "";

      const files = setup.files || {};
      const dependencies = setup.dependencies || undefined;
      const template = setup.template || "react";

      const normalizedFiles = {};
      for (const [path, v] of Object.entries(files)) {
        if (typeof v === "string") normalizedFiles[path] = v;
        else if (v && typeof v === "object" && "contents" in v) normalizedFiles[path] = v.contents;
        else normalizedFiles[path] = String(v ?? "");
      }

      const client = new SandpackClient(root, normalizedFiles, {
        template,
        dependencies,
      });

      client.listen((msg) => {
        if (msg.type === "status" && (msg.status === "running" || msg.status === "idle")) {
          hideOverlay();
        }
        if (msg.type === "error") {
          showError(msg.error || "Unknown Sandpack error");
        }
      });

      setTimeout(() => hideOverlay(), 2500);
    } catch (e) {
      showError(e);
    }
  }

  btnReload?.addEventListener("click", () => start());
  start();
</script>
</body>
</html>`;
}

serve(async (req) => {
  const started = Date.now();
  const ip =
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown";

  // Rate limit early
  if (isRateLimited(ip)) {
    return json({ ok: false, error: "Rate limit exceeded" }, 429);
  }

  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret") ?? "";

    if (!secret) {
      return html(
        `<!doctype html><meta charset="utf-8"><title>Missing secret</title><pre>Missing ?secret=...</pre>`,
        400,
      );
    }

    const record = await fetchPreviewRecord(secret);
    if (!record) {
      return html(
        `<!doctype html><meta charset="utf-8"><title>Not found</title><pre>Preview not found (invalid secret?)</pre>`,
        404,
      );
    }

    if (isExpired(record.expires_at)) {
      return html(
        `<!doctype html><meta charset="utf-8"><title>Expired</title><pre>Preview expired. Please create a new one.</pre>`,
        404,
      );
    }

    // Size safety net for DB payload
    const fileBytes = approxFilesPayloadSize(record.files ?? {});
    if (fileBytes > MAX_FILES_BYTES) {
      return html(
        `<!doctype html><meta charset="utf-8"><title>Too large</title><pre>Preview files exceed 3MB limit.</pre>`,
        413,
      );
    }

    const createdAt = record.created_at
      ? new Date(record.created_at).toISOString().slice(0, 16).replace("T", " ")
      : "";
    const expiresAt = record.expires_at
      ? new Date(record.expires_at).toISOString().slice(0, 16).replace("T", " ")
      : "";

    const metaTemplate =
      record?.meta && typeof record.meta === "object"
        ? (record.meta as any)?.template
        : undefined;

    const page = renderPage({
      name: record.name || "Preview",
      createdAt,
      expiresAt,
      files: record.files ?? {},
      dependencies: record.dependencies ?? undefined,
      template: typeof metaTemplate === "string" ? metaTemplate : undefined,
    });

    // Response size check
    const pageBytes = utf8Size(page);
    if (pageBytes > MAX_RESPONSE_BYTES) {
      return html(
        `<!doctype html><meta charset="utf-8"><title>Response too large</title><pre>Generated preview exceeds size limit.</pre>`,
        413,
      );
    }

    const ms = Date.now() - started;
    const fileCount = record.files ? Object.keys(record.files).length : 0;
    console.log(
      `[preview_page] ip=${ip} name=${record.name ?? "?"} files=${fileCount} bytes=${fileBytes} ms=${ms}`,
    );

    return html(page, 200);
  } catch (e) {
    console.error("[preview_page] error:", e);
    return json(
      {
        ok: false,
        error: String((e as any)?.stack || (e as any)?.message || e),
      },
      500,
    );
  }
});
