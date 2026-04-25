import {
  MAX_RESPONSE_BYTES,
  escapeHtml,
  html,
  htmlPreviewError,
  safeJsonForScript,
  utf8Size,
} from "./helpers.ts";
import type { SnackFiles } from "./helpers.ts";

export function renderPage(params: {
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
  allowEsmShCdn: boolean;
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
    allowEsmShCdn,
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
<body data-k1w1-preview-context="isolated">
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

  function sanitizeClientErrorText(input) {
    const value = String(input ?? "");
    return value.replace(/\s+/g, " ").trim().slice(0, 600);
  }

  function setOverlayState(state, message) {
    if (!overlay) return;

    overlay.textContent = "";
    overlay.classList.remove("error-overlay");

    if (state === "loading") {
      const spinner = document.createElement("div");
      spinner.className = "spinner";
      const label = document.createElement("div");
      label.className = "overlay-text";
      label.textContent = "Booting preview…";
      overlay.append(spinner, label);
      return;
    }

    overlay.classList.add("error-overlay");
    const title = document.createElement("div");
    title.className = "error-title";
    title.textContent = "Preview Error";
    const body = document.createElement("div");
    body.className = "error-message";
    body.textContent = sanitizeClientErrorText(message || "Unable to load preview.");
    overlay.append(title, body);
  }

  const ALLOW_ESM_SH_CDN = ${allowEsmShCdn ? "true" : "false"};

  function hideOverlay() {
    overlay?.classList.add("hidden");
  }

  function showError(err) {
    appendLog("[error] " + String(String(err?.message || err)));
    overlay?.classList.remove("hidden");
    setOverlayState("error", err?.message || err);
  }

  async function start() {
    try {
      overlay?.classList.remove("hidden");
      setOverlayState("loading");

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

      if (!ALLOW_ESM_SH_CDN) {
        throw new Error("CDN runtime disabled in this environment.");
      }
      const { SandpackClient } = await import("https://esm.sh/@codesandbox/sandpack-client@2.19.0");

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
      showError(e);
      if (!SHOW_RUNTIME_ERRORS) {
        appendLog("[runtime-error surfaced] startup/render guard failure");
      }
    }
  }

  btnReload?.addEventListener("click", () => start());
  start();
</script>
</body>
</html>`;
}

export function renderFragmentBootstrapPage(params: { nonce: string }): string {
  const { nonce } = params;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Preview</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0a0a0a; color: #c8c8c8; font-family: system-ui, -apple-system, sans-serif; }
  .box { text-align: center; padding: 20px; }
  .spinner { width: 36px; height: 36px; margin: 0 auto 12px; border: 3px solid #222; border-top-color: #00ff88; border-radius: 50%; animation: spin .8s linear infinite; }
  .err { color: #ff6b6b; margin-top: 10px; font-family: ui-monospace, Consolas, "Liberation Mono", "Courier New", monospace; white-space: pre-wrap; word-break: break-word; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
  <div class="box">
    <div class="spinner"></div>
    <div>Loading preview…</div>
    <div id="err" class="err" role="alert" aria-live="polite"></div>
  </div>
  <script type="module" nonce="${nonce}">
    const errEl = document.getElementById("err");
    const writeError = (msg) => {
      if (!errEl) return;
      errEl.textContent = String(msg || "Preview token missing.");
    };

    const current = new URL(window.location.href);
    const hash = current.hash.startsWith("#") ? current.hash.slice(1) : "";
    const hashParams = new URLSearchParams(hash);
    const secret = (hashParams.get("secret") || "").trim();

    if (!secret) {
      writeError("Preview token missing.");
    } else if (current.searchParams.get("transport") !== "fragment") {
      writeError("Preview transport must be fragment-isolated.");
    } else if (current.origin !== window.location.origin) {
      writeError("Preview origin mismatch.");
    } else {
      current.hash = "";
      try {
        window.history.replaceState(null, "", current.pathname + current.search);
      } catch (err) {
        console.warn("preview_page: history replace failed", err);
      }

      fetch(current.toString(), {
        method: "GET",
        credentials: "omit",
        redirect: "error",
        headers: {
          "x-k1w1-preview-secret": secret,
        },
      })
        .then(async (res) => {
          const ctype = (res.headers.get("content-type") || "").toLowerCase();
          if (!res.ok || !ctype.includes("text/html")) {
            throw new Error("Preview bootstrap received invalid response.");
          }
          return await res.text();
        })
        .then((page) => {
          if (!page.includes('data-k1w1-preview-context="isolated"')) {
            throw new Error("Preview bootstrap rejected unisolated HTML.");
          }
          document.open();
          document.write(page);
          document.close();
        })
        .catch((err) => {
          console.warn("preview_page: fragment bootstrap fetch failed", err);
          writeError("Preview could not be loaded.");
        });
    }
  </script>
</body>
</html>`;
}

export function renderPreviewResponse(params: {
  page: string;
  nonce: string;
}): Response {
  const { page, nonce } = params;

  const pageBytes = utf8Size(page);
  if (pageBytes > MAX_RESPONSE_BYTES) {
    return htmlPreviewError({
      code: "preview_response_too_large",
      nonce,
      title: "Response too large",
      message: "Generated preview exceeds size limit.",
    });
  }

  return html(page, nonce, 200);
}
