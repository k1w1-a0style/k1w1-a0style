// lib/sandpackBuilder.ts
// Builds React Preview HTML using CDN imports (no Sandpack dependency)

export interface SandpackOptions {
  title: string;
  files: Record<string, string>;
  dependencies?: Record<string, string>;
  /** Sandpack Client Version (unused, kept for compatibility) */
  sandpackVersion?: string;
  /** Zeige Datei-Explorer in der Preview */
  showFileExplorer?: boolean;
}

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
 * Escape string für JavaScript template literal
 */
function escapeForJs(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

/**
 * Extrahiert App-Komponenten-Code aus den Dateien
 */
function findAppCode(files: Record<string, string>): string {
  // Suche nach App-Datei
  const appPaths = [
    "/src/App.tsx",
    "/App.tsx",
    "/src/App.jsx",
    "/App.jsx",
    "/src/App.ts",
    "/App.ts",
    "/src/App.js",
    "/App.js",
  ];

  for (const path of appPaths) {
    if (files[path]) {
      return files[path];
    }
  }

  // Default App
  return `
function App() {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ color: "#00ff88" }}>Preview läuft ✅</h1>
      <p style={{ color: "#888" }}>Keine App.tsx gefunden.</p>
    </div>
  );
}
export default App;
`;
}

/**
 * Baut ein vollständiges HTML-Dokument mit React CDN
 * Verwendet esm.sh für schnelles Laden ohne Build-Step
 */
export function buildSandpackHtml(opts: SandpackOptions): string {
  const { title, files } = opts;

  const safeTitle = sanitizeTitle(title);
  const fileCount = Object.keys(files).length;

  // App Code extrahieren und für JS escapen
  const appCode = escapeForJs(findAppCode(files));

  // CSS aus Dateien sammeln
  const cssFiles = Object.entries(files)
    .filter(([path]) => path.endsWith(".css"))
    .map(([, content]) => content)
    .join("\n");

  const escapedCss = escapeForJs(cssFiles);

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
    min-height: 100%; 
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
    height: 44px; 
    background: rgba(10,10,10,0.95);
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
    background: #00ff88;
    box-shadow: 0 0 6px #00ff8855;
  }
  .status-dot.loading { background: #ffaa00; animation: pulse 1s ease infinite; }
  .status-dot.error { background: #ff4444; }
  
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  
  #app-root { 
    padding-top: 44px; 
    min-height: 100vh;
  }
  
  #loading { 
    position: fixed; 
    inset: 0; 
    display: flex; 
    align-items: center; 
    justify-content: center; 
    flex-direction: column; 
    gap: 12px; 
    background: #0a0a0a; 
    z-index: 9998;
  }
  #loading.hidden { display: none; }
  
  .spinner { 
    width: 36px; 
    height: 36px; 
    border-radius: 50%; 
    border: 3px solid #1a1a1a; 
    border-top-color: #00ff88; 
    animation: spin 0.7s linear infinite; 
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  
  .loading-text { font-size: 13px; color: #888; }
  
  #error-box { 
    display: none; 
    max-width: 480px; 
    padding: 16px; 
    border-radius: 14px; 
    border: 1px solid #5b2020; 
    background: #1a0808; 
    color: #ffb3b3; 
    margin: 80px auto 0;
  }
  #error-box strong { color: #ff6b6b; display: block; margin-bottom: 8px; }
  #error-box pre { 
    white-space: pre-wrap; 
    word-break: break-word; 
    margin: 0; 
    font-family: monospace; 
    font-size: 12px; 
    max-height: 200px;
    overflow-y: auto;
  }
</style>
<style id="custom-css">${escapedCss}</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="title">${safeTitle}</div>
      <div class="meta">React Preview • ${fileCount} Dateien</div>
    </div>
    <div class="status">
      <span class="status-dot" id="statusDot"></span>
      <span id="statusText">Bereit</span>
    </div>
  </div>

  <div id="loading">
    <div class="spinner"></div>
    <div class="loading-text">Lade React...</div>
  </div>
  
  <div id="app-root"></div>
  <div id="error-box"><strong>❌ Fehler</strong><pre id="error-text"></pre></div>

<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@18.2.0",
    "react-dom": "https://esm.sh/react-dom@18.2.0",
    "react-dom/client": "https://esm.sh/react-dom@18.2.0/client",
    "react/jsx-runtime": "https://esm.sh/react@18.2.0/jsx-runtime"
  }
}
</script>

<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script type="module">
const loading = document.getElementById("loading");
const errorBox = document.getElementById("error-box");
const errorText = document.getElementById("error-text");
const statusDot = document.getElementById("statusDot");
const statusTextEl = document.getElementById("statusText");

function showError(msg) {
  loading.classList.add("hidden");
  errorBox.style.display = "block";
  errorText.textContent = String(msg);
  statusDot.className = "status-dot error";
  statusTextEl.textContent = "Fehler";
}

try {
  // Dynamisch React laden
  const [React, ReactDOM] = await Promise.all([
    import("react"),
    import("react-dom/client")
  ]);

  // App Code als Funktion evaluieren
  const appCode = \`${appCode}\`;
  
  // Einfache Komponente die den Code rendert
  let UserApp = null;
  let userAppError = null;

  const loadUserApp = async () => {
    try {
      if (!appCode || !appCode.trim()) throw new Error("Kein App Code gefunden");
      if (typeof Babel === "undefined") throw new Error("Babel Standalone nicht geladen");

      const compiled = Babel.transform(appCode, {
        presets: ["env", "react", "typescript"],
        sourceType: "module",
      }).code;

      const exports = {};
      const module = { exports };
      const require = (name) => {
        if (name === "react") return React;
        // Minimal Shim für häufige Imports, damit simple Apps nicht sofort crashen
        if (name === "react-native") return {};
        return {};
      };

      const fn = new Function(
        "React",
        "exports",
        "module",
        "require",
        compiled + "\nreturn module.exports.default || exports.default || module.exports || exports;",
      );

      const mod = fn(React, exports, module, require);
      const Comp = (mod && mod.default) ? mod.default : mod;

      if (!Comp) throw new Error("Default export nicht gefunden");
      return Comp;
    } catch (e) {
      userAppError = e;
      return null;
    }
  };

  function PreviewApp() {
    if (UserApp) {
      return React.createElement(UserApp);
    }

    return React.createElement(
      "div",
      {
        style: {
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: 16,
          lineHeight: 1.4,
        },
      },
      React.createElement("h2", { style: { margin: 0 } }, "Preview (Fallback)"),
      React.createElement(
        "p",
        { style: { opacity: 0.8 } },
        "Lokales Fallback (ohne Supabase). Dateien: ",
        String(fileCount),
      ),
      userAppError
        ? React.createElement(
            "pre",
            {
              style: {
                whiteSpace: "pre-wrap",
                background: "#111",
                color: "#fff",
                padding: 12,
                borderRadius: 8,
                marginTop: 12,
              },
            },
            String(userAppError?.message || userAppError),
          )
        : null,
    );
  }


  UserApp = await loadUserApp();

  const root = ReactDOM.createRoot(document.getElementById("app-root"));
  root.render(React.createElement(PreviewApp));
  
  statusDot.className = "status-dot";
  statusTextEl.textContent = "Bereit";
  
} catch (e) {
  showError(e?.message || String(e));
}
</script>
</body>
</html>`;
}
