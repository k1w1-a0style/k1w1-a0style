// lib/sandpackBuilder.ts
// Builds Sandpack HTML for preview

export interface SandpackOptions {
  title: string;
  files: Record<string, string>;
  dependencies?: Record<string, string>;
  /** Sandpack Client Version (default: 2.19.0) */
  sandpackVersion?: string;
  /** Zeige Datei-Explorer in der Preview */
  showFileExplorer?: boolean;
}

// Sandpack Client Version - Update bei Bedarf
const DEFAULT_SANDPACK_VERSION = "2.19.0";

// CDN URL für Sandpack Client
const SANDPACK_CDN_URL = "https://esm.sh/@codesandbox/sandpack-client";

/**
 * Sanitize HTML-kritische Zeichen im Titel
 */
function sanitizeTitle(title: string): string {
  return title
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Baut ein vollständiges HTML-Dokument mit eingebettetem Sandpack
 */
export function buildSandpackHtml(opts: SandpackOptions): string {
  const {
    title,
    files,
    dependencies,
    sandpackVersion = DEFAULT_SANDPACK_VERSION,
  } = opts;

  const safeTitle = sanitizeTitle(title);
  const fileCount = Object.keys(files).length;

  // Sandpack Config
  const config = {
    template: "react-ts",
    files: Object.fromEntries(
      Object.entries(files).map(([k, v]) => [k, { code: v }]),
    ),
    customSetup: dependencies ? { dependencies } : undefined,
    options: {
      externalResources: [] as string[],
      bundlerURL: "https://sandpack-bundler.codesandbox.io",
      skipEval: false,
    },
  };

  // JSON sicher encodieren für Script-Tag
  const configJson = JSON.stringify(config)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  const cdnUrl = `${SANDPACK_CDN_URL}@${sandpackVersion}`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover" />
<meta name="color-scheme" content="dark" />
<title>${safeTitle}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { 
    margin: 0; 
    padding: 0; 
    height: 100%; 
    background: #0a0a0a; 
    color: #eee; 
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; 
    -webkit-font-smoothing: antialiased;
  }
  
  .header { 
    position: fixed; 
    top: 0; 
    left: 0; 
    right: 0; 
    height: 48px; 
    background: rgba(10,10,10,0.98);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-bottom: 1px solid #1a1a1a; 
    display: flex; 
    align-items: center; 
    justify-content: space-between; 
    padding: 0 12px; 
    z-index: 9999; 
  }
  
  .header-left { display: flex; flex-direction: column; }
  .title { font-weight: 800; font-size: 14px; color: #00ff88; letter-spacing: -0.3px; }
  .meta { font-size: 11px; color: #666; margin-top: 1px; }
  
  .header-actions { display: flex; gap: 8px; align-items: center; }
  
  .btn { 
    padding: 7px 12px; 
    background: #151515; 
    border: 1px solid #2a2a2a; 
    border-radius: 8px; 
    color: #ddd; 
    font-weight: 700; 
    font-size: 12px;
    cursor: pointer; 
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .btn:hover { background: #1f1f1f; border-color: #3a3a3a; }
  .btn:active { transform: scale(0.97); }
  .btn-icon { font-size: 14px; }
  
  .status { 
    font-size: 11px; 
    color: #666; 
    display: flex; 
    align-items: center; 
    gap: 5px;
  }
  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #444;
    transition: background 0.3s ease;
  }
  .status-dot.ready { background: #00ff88; box-shadow: 0 0 6px #00ff8855; }
  .status-dot.loading { background: #ffaa00; animation: pulse 1s ease infinite; }
  .status-dot.error { background: #ff4444; }
  
  @keyframes pulse { 
    0%, 100% { opacity: 1; } 
    50% { opacity: 0.5; } 
  }
  
  .content { 
    position: absolute; 
    top: 48px; 
    left: 0; 
    right: 0; 
    bottom: 0; 
  }
  
  #frame { 
    width: 100%; 
    height: 100%; 
    border: 0; 
    background: #000; 
  }
  
  #overlay { 
    position: absolute; 
    inset: 0; 
    display: flex; 
    align-items: center; 
    justify-content: center; 
    flex-direction: column; 
    gap: 12px; 
    background: #0a0a0a; 
  }
  #overlay.hidden { display: none; }
  
  .spinner { 
    width: 40px; 
    height: 40px; 
    border-radius: 50%; 
    border: 3px solid #1a1a1a; 
    border-top-color: #00ff88; 
    animation: spin 0.7s linear infinite; 
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  
  .loading-text { 
    font-size: 13px; 
    color: #888; 
    text-align: center; 
    padding: 0 24px; 
    line-height: 1.5; 
  }
  .loading-sub {
    font-size: 11px;
    color: #555;
    margin-top: 4px;
  }
  
  #error { 
    display: none; 
    max-width: 480px; 
    padding: 16px; 
    border-radius: 14px; 
    border: 1px solid #5b2020; 
    background: #1a0808; 
    color: #ffb3b3; 
    margin: 0 16px;
  }
  #error strong { color: #ff6b6b; display: block; margin-bottom: 8px; font-size: 14px; }
  #error pre { 
    white-space: pre-wrap; 
    word-break: break-word; 
    margin: 0; 
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; 
    font-size: 12px; 
    color: #ffcccc;
    line-height: 1.5;
    max-height: 200px;
    overflow-y: auto;
  }
  #error .hint {
    font-size: 11px;
    color: #888;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #2a1515;
  }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="title">${safeTitle}</div>
      <div class="meta">Sandpack Preview • ${fileCount} Dateien</div>
    </div>
    <div class="header-actions">
      <div class="status">
        <span class="status-dot loading" id="statusDot"></span>
        <span id="statusText">Lädt...</span>
      </div>
      <button class="btn" id="btnReload">
        <span class="btn-icon">↻</span>
        Reload
      </button>
    </div>
  </div>

  <div class="content">
    <iframe id="frame" sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts" allow="clipboard-write"></iframe>
    <div id="overlay">
      <div class="spinner"></div>
      <div class="loading-text">
        Initialisiere Sandpack…
        <div class="loading-sub">Benötigt Internetverbindung für Module</div>
      </div>
      <div id="error">
        <strong>❌ Fehler beim Laden</strong>
        <pre id="errorText"></pre>
        <div class="hint">
          💡 Prüfe deine Internetverbindung und versuche es erneut.
        </div>
      </div>
    </div>
  </div>

<script type="module">
  const overlay = document.getElementById("overlay");
  const errorBox = document.getElementById("error");
  const errorText = document.getElementById("errorText");
  const frame = document.getElementById("frame");
  const btnReload = document.getElementById("btnReload");
  const statusDot = document.getElementById("statusDot");
  const statusTextEl = document.getElementById("statusText");

  const config = ${configJson};

  function setStatus(state, text) {
    statusDot.className = "status-dot " + state;
    statusTextEl.textContent = text;
  }

  function showError(msg) {
    errorBox.style.display = "block";
    errorText.textContent = String(msg || "Unbekannter Fehler");
    setStatus("error", "Fehler");
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
    setStatus("ready", "Bereit");
  }

  btnReload.addEventListener("click", () => {
    overlay.classList.remove("hidden");
    errorBox.style.display = "none";
    setStatus("loading", "Lädt...");
    try { location.reload(); } catch {}
  });

  // Timeout für langsame Verbindungen
  const loadTimeout = setTimeout(() => {
    if (!overlay.classList.contains("hidden")) {
      showError("Timeout: Sandpack konnte nicht geladen werden. Prüfe deine Internetverbindung.");
    }
  }, 30000);

  try {
    setStatus("loading", "Module laden...");
    
    const mod = await import("${cdnUrl}");

    // ESM.sh kann CommonJS Exporte unter "default" wrappen
    const SandpackClient =
      mod.SandpackClient ||
      (mod.default && mod.default.SandpackClient) ||
      mod.default ||
      mod;

    if (typeof SandpackClient !== "function") {
      throw new Error("SandpackClient konnte nicht initialisiert werden. Module-Format-Fehler.");
    }

    setStatus("loading", "Bundler starten...");

    const client = new SandpackClient(frame, config, {
      showLoadingScreen: true,
      showOpenInCodeSandbox: false,
    });

    client.listen((msg) => {
      if (msg?.type === "start") {
        clearTimeout(loadTimeout);
        hideOverlay();
      }
      if (msg?.type === "done") {
        hideOverlay();
      }
      if (msg?.type === "action" && msg?.action === "show-error") {
        showError(msg?.title || msg?.message || "Kompilierungsfehler");
      }
      if (msg?.type === "error") {
        const errorMsg = msg?.error?.message || msg?.message || JSON.stringify(msg);
        showError(errorMsg);
      }
    });

    // Fallback: Overlay nach kurzer Zeit ausblenden
    setTimeout(() => {
      if (!overlay.classList.contains("hidden") && !errorBox.style.display) {
        hideOverlay();
      }
    }, 3000);

  } catch (e) {
    clearTimeout(loadTimeout);
    showError(e?.message || String(e));
  }
</script>
</body>
</html>`;
}
