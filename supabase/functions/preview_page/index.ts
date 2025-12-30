// supabase/functions/preview_page/index.ts
// Serves a lightweight preview page for a previously "saved preview" (by secret).
// IMPORTANT: Supabase often adds a very strict default CSP (default-src 'none'; sandbox)
// unless you override it. That strict CSP breaks Sandpack/WebView and causes a white screen.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type PreviewRecord = {
  name: string;
  secret: string;
  created_at: string;
  expires_at: string;
  // payload holds files, dependencies, etc.
  payload: unknown;
};

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

function html(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",

      // ✅ Override Supabase default CSP (often: default-src 'none'; sandbox)
      // Otherwise Sandpack (scripts/iframes) won't run and you'll see a white screen.
      "Content-Security-Policy": [
        "default-src 'self' https: data: blob:",
        "img-src 'self' https: data: blob:",
        "media-src 'self' https: data: blob:",
        "font-src 'self' https: data: blob:",
        "style-src 'self' 'unsafe-inline' https: data: blob:",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:",
        "connect-src 'self' https: wss: data: blob:",
        "frame-src 'self' https: data: blob:",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
      ].join("; "),
      "Referrer-Policy": "no-referrer",
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

// This expects you saved previews in Supabase (DB + storage).
// The "save_preview" function returns previewUrl like:
// /functions/v1/preview_page?secret=...
//
// In your project, you likely store preview records in a table.
// We'll try a safe, conventional approach with Supabase REST:
// GET /rest/v1/previews?secret=eq.<secret>&select=...
//
// If your table name differs, adjust TABLE below.
const TABLE = "previews";

// ✅ FIX: Use SERVICE_ROLE key server-side to bypass RLS
function supabaseHeaders(): Record<string, string> {
  // Server-side: use SERVICE_ROLE key (has full access, bypasses RLS)
  const serviceRoleKey =
    Deno.env.get("PREVIEW_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    "";

  if (!serviceRoleKey) {
    throw new Error(
      "Missing PREVIEW_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    "content-type": "application/json",
  };
}

async function fetchPreviewRecord(
  secret: string,
): Promise<PreviewRecord | null> {
  const base =
    Deno.env.get("PREVIEW_SUPABASE_URL") ??
    Deno.env.get("EXPO_PUBLIC_SUPABASE_URL") ??
    Deno.env.get("SUPABASE_URL") ??
    "";
  if (!base) return null;

  const restUrl = `${base}/rest/v1/${TABLE}?secret=eq.${encodeURIComponent(secret)}&select=name,secret,created_at,expires_at,payload&limit=1`;

  try {
    const res = await fetch(restUrl, {
      method: "GET",
      headers: supabaseHeaders(),
    });

    if (!res.ok) return null;
    const arr = (await res.json()) as PreviewRecord[];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr[0];
  } catch (e) {
    console.error("fetchPreviewRecord error:", e);
    return null;
  }
}

// Build a Sandpack page that can run Expo/React stuff in-browser.
// You probably already tuned this in your save_preview/preview_page before;
// this is a pragmatic implementation that works with many JS/TS projects.
function renderPage(params: {
  name: string;
  createdAt: string;
  expiresAt: string;
  payload: any;
}) {
  const { name, createdAt, expiresAt, payload } = params;

  // payload is whatever your save_preview stored.
  // We'll accept:
  // - payload.files: { [path]: { contents: string } }  (CodeSandbox-like)
  // - payload.dependencies: { [pkg]: version }
  // - payload.devDependencies: { ... }
  // - payload.template: "react" | "vite-react" | etc (optional)

  const files = payload?.files ?? {};
  const dependencies = payload?.dependencies ?? undefined;
  const devDependencies = payload?.devDependencies ?? undefined;
  const template = payload?.template ?? "react";

  const sandpackSetup = {
    files,
    dependencies,
    devDependencies,
    template,
  };

  const sandpackJson = JSON.stringify(sandpackSetup);

  // UI: simple header + iframe area. Sandpack mounts inside #root.
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

  // Sandpack client runtime
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

      // Build sandbox config for SandpackClient
      const files = setup.files || {};
      const dependencies = setup.dependencies || undefined;
      const devDependencies = setup.devDependencies || undefined;
      const template = setup.template || "react";

      // SandpackClient expects a "files" object with path->content or { code }
      // We'll normalize CodeSandbox-like { contents } to plain string.
      const normalizedFiles = {};
      for (const [path, v] of Object.entries(files)) {
        if (typeof v === "string") normalizedFiles[path] = v;
        else if (v && typeof v === "object" && "contents" in v) normalizedFiles[path] = v.contents;
        else if (v && typeof v === "object" && "code" in v) normalizedFiles[path] = v.code;
        else normalizedFiles[path] = String(v ?? "");
      }

      const client = new SandpackClient(root, normalizedFiles, {
        template,
        dependencies,
        devDependencies,
      });

      client.listen((msg) => {
        // Hide overlay once preview is running
        if (msg.type === "status" && (msg.status === "running" || msg.status === "idle")) {
          hideOverlay();
        }
        if (msg.type === "error") {
          showError(msg.error || "Unknown Sandpack error");
        }
      });

      // small fallback
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
        `<!doctype html><meta charset="utf-8"><title>Not found</title><pre>Preview not found (invalid/expired secret?)</pre>`,
        404,
      );
    }

    const createdAt = record.created_at
      ? new Date(record.created_at).toISOString().slice(0, 16).replace("T", " ")
      : "";
    const expiresAt = record.expires_at
      ? new Date(record.expires_at).toISOString().slice(0, 16).replace("T", " ")
      : "";

    const page = renderPage({
      name: record.name || "preview",
      createdAt,
      expiresAt,
      payload: record.payload ?? {},
    });

    return html(page, 200);
  } catch (e) {
    return json({ ok: false, error: String(e?.stack || e?.message || e) }, 500);
  }
});
