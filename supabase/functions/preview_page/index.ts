// supabase/functions/preview_page/index.ts
// REFACTORED: helpers → helpers.ts

import {
  TABLE, MAX_FILES_BYTES, MAX_RESPONSE_BYTES,
  json, escapeHtml, safeJsonForScript, getSupabaseBaseUrl, supabaseHeaders,
  withTimeout, utf8Size, approxFilesPayloadSize, randomNonce, html,
  serve, rateLimit, sanitizeErrorText,
} from "./helpers.ts";
import type { SnackFiles, PreviewRecord } from "./helpers.ts";

type PreviewMeta = { template?: unknown };

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
      console.error(
        "preview_page: failed to parse JSON:",
        sanitizeErrorText(e instanceof Error ? e.message : String(e)),
      );
      return null;
    }

    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr[0] as PreviewRecord;
  } catch (e) {
    console.error(
      "fetchPreviewRecord error:",
      sanitizeErrorText(e instanceof Error ? e.message : String(e)),
    );
    return null;
  } finally {
    t.cancel();
  }
}

async function deletePreviewRecord(secret: string): Promise<void> {
  const base = getSupabaseBaseUrl();
  if (!base) return;

  const restUrl = `${base}/rest/v1/${TABLE}?secret=eq.${encodeURIComponent(secret)}`;

  const t = withTimeout(6000);
  try {
    await fetch(restUrl, {
      method: "DELETE",
      headers: supabaseHeaders(),
      signal: t.signal,
    });
  } catch (e) {
    console.error(
      "deletePreviewRecord error:",
      sanitizeErrorText(e instanceof Error ? e.message : String(e)),
    );
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

function parseToggleParam(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function withToggleUrl(params: {
  baseUrl: URL;
  showRawLogs: boolean;
  showRuntimeErrors: boolean;
}): string {
  const { baseUrl, showRawLogs, showRuntimeErrors } = params;
  const url = new URL(baseUrl.toString());
  url.searchParams.set("logs", showRawLogs ? "1" : "0");
  url.searchParams.set("runtime_errors", showRuntimeErrors ? "1" : "0");
  return url.toString();
}

function renderPage(params: {
  name: string;
  createdAt: string;
  expiresAt: string;
  nonce: string;
  files: SnackFiles;
  dependencies?: Record<string, string>;
  template?: string;
  showRawLogs: boolean;
  showRuntimeErrors: boolean;
  logsToggleUrl: string;
  runtimeErrorsToggleUrl: string;
}) {
  const {
    name,
    createdAt,
    expiresAt,
    nonce,
    files,
    dependencies,
    template,
    showRawLogs,
    showRuntimeErrors,
    logsToggleUrl,
    runtimeErrorsToggleUrl,
  } = params;

  const sandpackSetup = {
    files,
    dependencies: dependencies ?? undefined,
    template: template ?? "react",
  };

  const sandpackJson = safeJsonForScript(sandpackSetup);
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
  .error-message { color: #ff6b6b; font-size: 14px; max-width: 520px; text-align: center; line-height: 1.5; font-family: ui-monospace, Consolas, "Liberation Mono", "Courier New", monospace; white-space: pre-wrap; word-break: break-word; padding: 0 16px; }
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
      <a class="btn" href="${escapeHtml(logsToggleUrl)}">Logs: ${showRawLogs ? "ON" : "OFF"}</a>
      <a class="btn" href="${escapeHtml(runtimeErrorsToggleUrl)}">Runtime Errors: ${showRuntimeErrors ? "ON" : "OFF"}</a>
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

  <pre id="raw-logs" style="display:${showRawLogs ? "block" : "none"}; position: fixed; left: 8px; right: 8px; bottom: 8px; max-height: 30vh; overflow: auto; padding: 8px; border: 1px solid #1c4d35; border-radius: 8px; background: rgba(0,0,0,0.75); color: #9cf8c9; font-size: 11px; line-height: 1.4; z-index: 99999;"></pre>

<script type="module" nonce="${nonce}">
  const overlay = document.getElementById("overlay");
  const btnReload = document.getElementById("btn-reload");
  const rawLogsEl = document.getElementById("raw-logs");

  const SHOW_RAW_LOGS = ${showRawLogs ? "true" : "false"};
  const SHOW_RUNTIME_ERRORS = ${showRuntimeErrors ? "true" : "false"};
  const setup = ${sandpackJson};

  function appendLog(message) {
    if (!SHOW_RAW_LOGS || !rawLogsEl) return;
    const now = new Date().toISOString().slice(11, 19);
    rawLogsEl.textContent = (now + " " + message + "\n" + (rawLogsEl.textContent || "")).slice(0, 12000);
  }

  import { SandpackClient } from "https://esm.sh/@codesandbox/sandpack-client@2.19.0";

  function hideOverlay() {
    overlay?.classList.add("hidden");
  }

  function showError(err) {
    appendLog("[error] " + String(String(err?.message || err)));
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

      appendLog("[start] files=" + String(Object.keys(normalizedFiles).length) + " template=" + String(template));

      const client = new SandpackClient(root, normalizedFiles, {
        template,
        dependencies,
      });

      client.listen((msg) => {
        if (SHOW_RAW_LOGS) {
          if (msg.type === "console" && "method" in msg) {
            appendLog("[console:" + String(msg.method) + "] " + String(JSON.stringify(msg.log ?? [])));
          } else if (msg.type === "error") {
            appendLog("[sandpack:error] " + String(String(msg.error || "Unknown Sandpack error")));
          }
        }

        if (msg.type === "status" && (msg.status === "running" || msg.status === "idle")) {
          hideOverlay();
        }
        if (msg.type === "error") {
          if (SHOW_RUNTIME_ERRORS) {
            showError(msg.error || "Unknown Sandpack error");
          }
        }
      });

      setTimeout(() => hideOverlay(), 2500);
    } catch (e) {
      if (SHOW_RUNTIME_ERRORS) {
        showError(e);
      } else {
        appendLog("[runtime-error suppressed] " + String(String(e?.message || e)));
      }
    }
  }

  btnReload?.addEventListener("click", () => start());
  start();
</script>
</body>
</html>`;
}

serve(async (req) => {
  const rl = rateLimit(req, "preview_page");
  if (rl) return rl;

  const started = Date.now();
  const ip =
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown";

  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret") ?? "";
    const showRawLogs = parseToggleParam(url.searchParams.get("logs"));
    const showRuntimeErrors = parseToggleParam(url.searchParams.get("runtime_errors"));
    const nonce = randomNonce();

    if (!secret) {
      return html(
        `<!doctype html><meta charset="utf-8"><title>Missing secret</title><pre>Missing ?secret=...</pre>`,
        nonce,
        400,
      );
    }

    const record = await fetchPreviewRecord(secret);
    if (!record) {
      return html(
        `<!doctype html><meta charset="utf-8"><title>Not found</title><pre>Preview not found (invalid secret?)</pre>`,
        nonce,
        404,
      );
    }

    if (isExpired(record.expires_at)) {
      await deletePreviewRecord(secret);
      return html(
        `<!doctype html><meta charset="utf-8"><title>Expired</title><pre>Preview expired. Please create a new one.</pre>`,
        nonce,
        410,
      );
    }

    // Size safety net for DB payload
    const fileBytes = approxFilesPayloadSize(record.files ?? {});
    if (fileBytes > MAX_FILES_BYTES) {
      return html(
        `<!doctype html><meta charset="utf-8"><title>Too large</title><pre>Preview files exceed 3MB limit.</pre>`,
        nonce,
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
        ? (record.meta as PreviewMeta).template
        : undefined;

    const logsToggleUrl = withToggleUrl({
      baseUrl: url,
      showRawLogs: !showRawLogs,
      showRuntimeErrors,
    });
    const runtimeErrorsToggleUrl = withToggleUrl({
      baseUrl: url,
      showRawLogs,
      showRuntimeErrors: !showRuntimeErrors,
    });

    const page = renderPage({
      nonce,
      name: record.name || "Preview",
      createdAt,
      expiresAt,
      files: record.files ?? {},
      dependencies: record.dependencies ?? undefined,
      template: typeof metaTemplate === "string" ? metaTemplate : undefined,
      showRawLogs,
      showRuntimeErrors,
      logsToggleUrl,
      runtimeErrorsToggleUrl,
    });

    // Response size check
    const pageBytes = utf8Size(page);
    if (pageBytes > MAX_RESPONSE_BYTES) {
      return html(
        `<!doctype html><meta charset="utf-8"><title>Response too large</title><pre>Generated preview exceeds size limit.</pre>`,
        nonce,
        413,
      );
    }

    const ms = Date.now() - started;
    const fileCount = record.files ? Object.keys(record.files).length : 0;
    console.log(
      `[preview_page] ip=${ip} name=${record.name ?? "?"} files=${fileCount} bytes=${fileBytes} logs=${showRawLogs ? "on" : "off"} runtimeErrors=${showRuntimeErrors ? "on" : "off"} ms=${ms}`,
    );

    return html(page, nonce, 200);
  } catch (e) {
    const safeError = sanitizeErrorText(e instanceof Error ? e.message : String(e));
    console.error("[preview_page] error:", safeError);
    return json({ ok: false, error: "Internal Server Error" }, 500);
  }
});
