// lib/sandpackBuilder.ts
// REFACTORED: helpers → sandpackHelpers.ts

// lib/sandpackBuilder.ts
// Builds the local HTML/Eval preview fallback only.
// This is intentionally not the product SoT: the primary path is the trusted remote WebView preview.
// Uses CDN imports + Babel + new Function on purpose as a dev-/best-effort-only fallback.

import {
  sanitizeTitle,
  escapeForJs,
  findAppCode,
  type SandpackOptions,
} from "./sandpackHelpers";
export type { SandpackOptions } from "./sandpackHelpers";

function isUnsafeLocalEvalAllowed(opts: SandpackOptions): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (opts.allowUnsafeLocalEval === true) return true;
  if (opts.allowUnsafeLocalEval === false) return false;
  if (process.env.NODE_ENV === "test") return true;
  return false;
}

function buildDisabledProductionFallbackHtml(title: string, fileCount: number): string {
  const safeTitle = sanitizeTitle(title);
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover" />
<meta name="color-scheme" content="dark" />
<title>${safeTitle}</title>
<style>
  html, body { margin: 0; padding: 0; min-height: 100%; background: #0a0a0a; color: #eee; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .card { max-width: 560px; border-radius: 14px; border: 1px solid #5b2020; background: #1a0808; padding: 16px; }
  h1 { margin: 0 0 10px; color: #ff6b6b; font-size: 16px; }
  p { margin: 0; color: #ffb3b3; font-size: 13px; line-height: 1.5; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Lokaler HTML-/Eval-Fallback deaktiviert</h1>
      <p>Production-/Release-Kontext: lokaler Eval-/Babel-/CDN-Pfad ist absichtlich gesperrt (${fileCount} Dateien). Bitte Remote-Preview ueber Supabase verwenden oder explizit Dev-Modus aktivieren.</p>
    </div>
  </div>
</body>
</html>`;
}

export function buildSandpackHtml(opts: SandpackOptions): string {
  const { title, files } = opts;
  const fileCount = Object.keys(files).length;

  if (!isUnsafeLocalEvalAllowed(opts)) {
    return buildDisabledProductionFallbackHtml(title, fileCount);
  }

  const safeTitle = sanitizeTitle(title);
  const csp = [
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://esm.sh",
    "style-src 'unsafe-inline'",
    "img-src data: blob: https:",
    "font-src data: https:",
    "connect-src 'none'",
  ].join("; ");

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
<meta http-equiv="Content-Security-Policy" content="${csp}" />
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
      <div class="meta">Lokaler HTML-/Eval-Fallback • nur im expliziten Local-/Dev-Modus • ${fileCount} Dateien • nicht server-verifiziert</div>
    </div>
    <div class="status">
      <span class="status-dot" id="statusDot"></span>
      <span id="statusText">Expliziter Dev-Fallback bereit</span>
    </div>
  </div>

  <div id="loading">
    <div class="spinner"></div>
    <div class="loading-text">Lade expliziten lokalen Dev-Fallback...</div>
  </div>
  
  <div id="app-root"></div>
  <div id="error-box"><strong>❌ Fehler</strong><pre id="error-text"></pre></div>

<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@19.1.0",
    "react-dom": "https://esm.sh/react-dom@19.1.0",
    "react-dom/client": "https://esm.sh/react-dom@19.1.0/client",
    "react/jsx-runtime": "https://esm.sh/react@19.1.0/jsx-runtime"
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
        if (name === "react-native-web") return require("react-native");
        // Minimal Shim für häufige Imports, damit simple Apps nicht sofort crashen
        if (name === "react-native") {
          // Minimal RN shim for local preview (no external deps)
          const React = require("react");
          const create = (tag) => (props) => React.createElement(tag, props, props?.children);
          const View = create("div");
          const Text = create("span");
          const ScrollView = create("div");
          const Pressable = create("button");
          const TouchableOpacity = create("button");
          const Image = (props) => React.createElement("img", props);
          const StyleSheet = { create: (s) => s };
          return {
            View,
            Text,
            ScrollView,
            Pressable,
            TouchableOpacity,
            Image,
            StyleSheet,
            Platform: { OS: "web" },
          };
        }
        // Expo / common libs shims for preview (no native runtime in WebView)
        if (name === "expo-status-bar") {
          return { StatusBar: () => null };
        }
        if (name === "@expo/vector-icons") {
          const React = require("react");
          const Icon = ({ name, size, color, ...rest }) =>
            React.createElement("span", { ...rest, title: String(name ?? "icon") }, "🔷");
          // Provide a few common icon sets
          return new Proxy(
            {},
            {
              get: (_t, prop) => {
                if (prop === "__esModule") return true;
                return Icon;
              },
            }
          );
        }
        if (name === "@react-native-async-storage/async-storage") {
          const mem = new Map();
          const api = {
            getItem: async (k) => (mem.has(k) ? String(mem.get(k)) : null),
            setItem: async (k, v) => void mem.set(k, String(v)),
            removeItem: async (k) => void mem.delete(k),
            clear: async () => void mem.clear(),
            getAllKeys: async () => Array.from(mem.keys()),
          };
          return { __esModule: true, default: api, ...api };
        }
        if (name === "uuid") {
          const v4 = () => "00000000-0000-4000-8000-000000000000";
          return { __esModule: true, v4, default: { v4 } };
        }

        // React Navigation (best-effort no-op navigator so screens can render)
        if (name === "@react-navigation/native") {
          const React = require("react");
          const NavigationContainer = ({ children }) => React.createElement(React.Fragment, null, children);
          const useNavigation = () => ({ navigate: () => {}, goBack: () => {}, setOptions: () => {} });
          const useRoute = () => ({ params: {} });
          return { __esModule: true, NavigationContainer, useNavigation, useRoute };
        }
        if (name === "@react-navigation/native-stack" || name === "@react-navigation/bottom-tabs") {
          const React = require("react");
          const make = () => ({
            Navigator: ({ children }) => React.createElement(React.Fragment, null, children),
            Screen: ({ component: Comp, children }) =>
              Comp ? React.createElement(Comp) : React.createElement(React.Fragment, null, children),
          });
          const createNativeStackNavigator = () => make();
          const createBottomTabNavigator = () => make();
          return { __esModule: true, createNativeStackNavigator, createBottomTabNavigator };
        }

        // RN ecosystem shims
        if (name === "react-native-gesture-handler") {
          const React = require("react");
          const GHRoot = ({ children, ...rest }) => React.createElement("div", rest, children);
          return { __esModule: true, GestureHandlerRootView: GHRoot };
        }
        if (name === "react-native-safe-area-context") {
          const React = require("react");
          const SafeAreaProvider = ({ children }) => React.createElement(React.Fragment, null, children);
          const SafeAreaView = ({ children, ...rest }) => React.createElement("div", rest, children);
          return { __esModule: true, SafeAreaProvider, SafeAreaView, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
        }
        if (name === "react-native-screens") {
          return { __esModule: true, enableScreens: () => {} };
        }
        if (name === "react-native-reanimated") {
          return { __esModule: true, default: {}, useSharedValue: (v) => ({ value: v }), useAnimatedStyle: (fn) => fn?.() ?? {}, withTiming: (v) => v };
        }

        return {};
      };

      // Intentional local fallback only: compile isolated preview code into the in-memory WebView runtime.
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
      React.createElement("h2", { style: { margin: 0 } }, "Lokaler Dev-Fallback"),
      React.createElement(
        "p",
        { style: { opacity: 0.8 } },
        "Lokaler HTML-/Eval-Fallback (ohne Remote-Preview). Dateien: ",
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
  statusTextEl.textContent = "Dev-Fallback bereit";
  
} catch (e) {
  showError(e?.message || String(e));
}
</script>
</body>
</html>`;
}
