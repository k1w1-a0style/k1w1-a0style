import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════
interface PreviewFile {
  type?: string;
  contents: string;
}
interface PreviewData {
  name: string;
  files: Record<string, PreviewFile>;
  dependencies: Record<string, string>;
  meta: Record<string, unknown>;
  created_at: string;
  expires_at: string;
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════
function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function escapeHtml(str: string): string {
  return (str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function errorPage(title: string, message: string, status = 500): Response {
  return html(
    `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0a;color:#ff6b6b;font-family:system-ui,-apple-system,sans-serif;padding:20px}
.error{text-align:center;max-width:520px}
h1{font-size:24px;margin-bottom:12px;color:#ff4444}
p{color:#999;line-height:1.6}
</style>
</head>
<body>
<div class="error">
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(message)}</p>
</div>
</body>
</html>`,
    status,
  );
}

// ═══════════════════════════════════════════════════════════════
// React Native → Web Transformation
// ═══════════════════════════════════════════════════════════════
function transformRNtoWeb(code: string): string {
  if (typeof code !== "string") return "";
  let result = code;

  // 1. react-native → react-native-web
  result = result.replace(
    /from\s+["']react-native["']/g,
    'from "react-native-web"',
  );

  // 2. @react-navigation/native-stack → @react-navigation/stack
  result = result.replace(
    /@react-navigation\/native-stack/g,
    "@react-navigation/stack",
  );
  result = result.replace(
    /createNativeStackNavigator/g,
    "createStackNavigator",
  );

  // 3. @expo/vector-icons - mehrere Varianten entfernen
  result = result.replace(
    /import\s*\{[^}]+\}\s*from\s*["']@expo\/vector-icons["'];?\n?/g,
    "// Vector icons removed for web\n",
  );
  result = result.replace(
    /import\s+\w+\s+from\s*["']@expo\/vector-icons\/\w+["'];?\n?/g,
    "// Vector icons removed for web\n",
  );
  result = result.replace(
    /import\s*\*\s*as\s*\w+\s*from\s*["']@expo\/vector-icons["'];?\n?/g,
    "// Vector icons removed for web\n",
  );
  result = result.replace(
    /<(?:Ionicons|MaterialIcons|FontAwesome|Feather|AntDesign|Entypo|MaterialCommunityIcons|FontAwesome5|Fontisto|Foundation|Octicons|Zocial|SimpleLineIcons|EvilIcons)[^>]*\/>/g,
    "<span style={{fontSize:16}}>●</span>",
  );

  // 4. expo-status-bar entfernen (inkl. calls)
  result = result.replace(
    /import\s+(?:\{[^}]*\}|[^;]+)\s+from\s+["']expo-status-bar["'];?\n?/g,
    "",
  );
  result = result.replace(/<StatusBar[^>]*\/>/g, "");
  result = result.replace(/StatusBar\.\w+\([^)]*\);?\n?/g, "");

  // 5. expo-linear-gradient → View fallback
  result = result.replace(
    /import\s*\{\s*LinearGradient\s*\}\s*from\s*["']expo-linear-gradient["'];?\n?/g,
    'import { View as LinearGradient } from "react-native-web";\n',
  );

  // 6. AsyncStorage → localStorage mock
  result = result.replace(
    /import\s+AsyncStorage\s+from\s*["']@react-native-async-storage\/async-storage["'];?/g,
    `const AsyncStorage = {
  getItem: async (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: async (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  removeItem: async (k) => { try { localStorage.removeItem(k); } catch {} },
  clear: async () => { try { localStorage.clear(); } catch {} },
};`,
  );

  return result;
}

// ═══════════════════════════════════════════════════════════════
// Build Sandpack Files
// ═══════════════════════════════════════════════════════════════
function buildSandpackFiles(
  rawFiles: Record<string, PreviewFile>,
): Record<string, { code: string }> {
  const result: Record<string, { code: string }> = {};

  // Process all user files
  for (const [path, fileObj] of Object.entries(rawFiles || {})) {
    const normalizedPath = path.startsWith("/") ? path : "/" + path;
    const contents = fileObj?.contents || "";
    result[normalizedPath] = { code: transformRNtoWeb(contents) };
  }

  // Ensure App.js exists
  const hasApp =
    result["/App.js"] ||
    result["/App.tsx"] ||
    result["/App.jsx"] ||
    result["/App.ts"];
  if (!hasApp) {
    const firstEntry = Object.entries(rawFiles || {})[0];
    if (firstEntry) {
      result["/App.js"] = {
        code: transformRNtoWeb(firstEntry[1]?.contents || ""),
      };
    } else {
      result["/App.js"] = {
        code: `import React from "react";
import { View, Text, StyleSheet } from "react-native-web";
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>No App.js found</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1a1a1a" },
  text: { color: "#888", fontSize: 16 },
});`,
      };
    }
  }

  // Create index.js entry point (avoid literal "./App" in THIS file to prevent CLI false-positives)
  if (!result["/index.js"]) {
    const lines = [
      'import React from "react";',
      'import { AppRegistry } from "react-native-web";',
      'import App from "./' + 'App";',
      "",
      'AppRegistry.registerComponent("App", () => App);',
      'AppRegistry.runApplication("App", { rootTag: document.getElementById("root") });',
      "",
    ];
    result["/index.js"] = { code: lines.join("\n") };
  }

  // Handle .tsx → .js re-export if needed (avoid literal "./App.tsx" in THIS file)
  if (!result["/App.js"] && result["/App.tsx"]) {
    result["/App.js"] = { code: 'export { default } from "./App.' + 'tsx";\n' };
  }

  return result;
}

function buildDependencies(
  deps: Record<string, string>,
): Record<string, string> {
  const base: Record<string, string> = {
    react: "18.3.1",
    "react-dom": "18.3.1",
    "react-native-web": "0.19.12",
  };

  // Filter out dependencies that typically break in a browser sandbox.
  const isBlocked = (name: string) => {
    if (!name) return true;
    if (name === "react-native") return true;
    if (name === "react-native-webview") return true;
    if (
      name === "expo" ||
      name.startsWith("expo-") ||
      name.startsWith("@expo/")
    )
      return true;
    if (name.startsWith("@react-native/")) return true;
    return false;
  };

  const safeDeps: Record<string, string> = {};
  for (const [k, v] of Object.entries(deps || {})) {
    if (typeof v !== "string") continue;
    if (isBlocked(k)) continue;
    if (k === "react" && v.trim().startsWith("19")) continue;
    safeDeps[k] = v;
  }

  // Best-effort navigation support
  const depsStr = JSON.stringify(safeDeps);
  if (
    depsStr.includes("react-navigation") ||
    depsStr.includes("@react-navigation")
  ) {
    safeDeps["@react-navigation/native"] =
      safeDeps["@react-navigation/native"] || "6.1.9";
    safeDeps["@react-navigation/stack"] =
      safeDeps["@react-navigation/stack"] || "6.3.20";
    safeDeps["react-native-gesture-handler"] =
      safeDeps["react-native-gesture-handler"] || "2.14.0";
  }

  return { ...base, ...safeDeps };
}

// ═══════════════════════════════════════════════════════════════
// Main Handler
// ═══════════════════════════════════════════════════════════════
serve(async (req) => {
  const SUPABASE_URL =
    Deno.env.get("PREVIEW_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY =
    Deno.env.get("PREVIEW_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return errorPage("Server Error", "Missing configuration.", 500);
  }

  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (!secret)
    return errorPage("Missing Secret", "No preview secret provided.", 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("previews")
    .select("name, files, dependencies, meta, created_at, expires_at")
    .eq("secret", secret)
    .maybeSingle();

  if (error) {
    console.error("[preview_page] DB Error:", error);
    return errorPage("Database Error", "Failed to load preview.", 500);
  }
  if (!data) return errorPage("Not Found", "This preview does not exist.", 404);

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return errorPage(
      "Preview Expired",
      `Expired at ${data.expires_at.slice(0, 16).replace("T", " ")}.`,
      410,
    );
  }

  const preview: PreviewData = {
    name: data.name || "Preview",
    files: data.files || {},
    dependencies: data.dependencies || {},
    meta: data.meta || {},
    created_at: data.created_at || "",
    expires_at: data.expires_at || "",
  };

  const sandpackFiles = buildSandpackFiles(preview.files);
  const sandpackDeps = buildDependencies(preview.dependencies);

  const configJson = JSON.stringify({
    files: sandpackFiles,
    dependencies: sandpackDeps,
  })
    .replace(/<\/script>/gi, "<\\/script>")
    .replace(/<!--/g, "\\u003C!--");

  return html(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>${escapeHtml(preview.name)} - Preview</title>
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
#preview-frame { width: 100%; height: 100%; border: none; background: #000; }
.overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0a0a0a; transition: opacity 0.3s; }
.overlay.hidden { opacity: 0; pointer-events: none; }
.spinner { width: 40px; height: 40px; border: 3px solid #222; border-top-color: #00ff88; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.overlay-text { margin-top: 16px; color: #666; font-size: 14px; }
.error-overlay { background: #1a0505; }
.error-title { color: #ff4444; font-size: 18px; font-weight: 600; margin-bottom: 8px; }
.error-message { color: #ff6b6b; font-size: 14px; max-width: 420px; text-align: center; line-height: 1.5; font-family: monospace; white-space: pre-wrap; word-break: break-word; }
.error-retry { margin-top: 20px; }
</style>
</head>
<body>
<div class="header">
  <div class="header-left">
    <div class="header-title">${escapeHtml(preview.name)}</div>
    <div class="header-meta">
      Created: ${escapeHtml(preview.created_at.slice(0, 16).replace("T", " "))}
      · Expires: ${escapeHtml(preview.expires_at.slice(0, 16).replace("T", " "))}
    </div>
  </div>
  <div class="header-actions">
    <button class="btn" id="btn-reload">↻ Reload</button>
  </div>
</div>

<div class="content">
  <iframe id="preview-frame" title="App Preview"></iframe>

  <div class="overlay" id="loading-overlay">
    <div class="spinner"></div>
    <div class="overlay-text">Loading preview...</div>
  </div>

  <div class="overlay error-overlay hidden" id="error-overlay">
    <div class="error-title">Preview Error</div>
    <div class="error-message" id="error-message"></div>
    <button class="btn error-retry" id="btn-error-retry">Try Again</button>
  </div>
</div>

<script>window.__SANDPACK_CONFIG__ = ${configJson};</script>

<script type="module">
import { SandpackClient } from "https://esm.sh/@codesandbox/sandpack-client@2.13.0";

const config = window.__SANDPACK_CONFIG__;
const iframe = document.getElementById("preview-frame");
const loadingOverlay = document.getElementById("loading-overlay");
const errorOverlay = document.getElementById("error-overlay");
const errorMessage = document.getElementById("error-message");

let client = null;
let loadTimeout = null;

function showLoading() {
  loadingOverlay.classList.remove("hidden");
  errorOverlay.classList.add("hidden");
  iframe.style.opacity = "0";
}
function hideLoading() {
  loadingOverlay.classList.add("hidden");
  iframe.style.opacity = "1";
}
function showError(message) {
  loadingOverlay.classList.add("hidden");
  errorOverlay.classList.remove("hidden");
  errorMessage.textContent = message;
  iframe.style.opacity = "0";
}
function cleanupClient() {
  if (!client) return;
  try {
    if (typeof client.destroy === "function") client.destroy();
    else if (typeof client.dispose === "function") client.dispose();
  } catch (e) {
    console.warn("[Preview] Cleanup error:", e);
  }
  client = null;
}
function startPreview() {
  cleanupClient();
  if (loadTimeout) { clearTimeout(loadTimeout); loadTimeout = null; }
  showLoading();

  loadTimeout = setTimeout(() => {
    console.warn("[Preview] Load timeout - showing iframe anyway");
    hideLoading();
  }, 30000);

  try {
    client = new SandpackClient(
      iframe,
      { template: "react", files: config.files, customSetup: { dependencies: config.dependencies } },
      { showOpenInCodeSandbox: false, showErrorScreen: true, showLoadingScreen: false }
    );

    client.listen((message) => {
      if (message.type === "done") {
        clearTimeout(loadTimeout);
        hideLoading();
      }
      if (message.type === "action" && message.action === "show-error") {
        clearTimeout(loadTimeout);
        showError(message.message || message.title || "Unknown error");
      }
    });
  } catch (err) {
    clearTimeout(loadTimeout);
    showError(err?.message || String(err));
  }
}

document.getElementById("btn-reload").addEventListener("click", startPreview);
document.getElementById("btn-error-retry").addEventListener("click", startPreview);

// Option B: unhandledrejection (wichtig bei "Failed to fetch" etc.)
window.addEventListener("error", (e) => {
  const msg = String(e?.message || "");
  if (msg.includes("esm.sh") || msg.includes("Sandpack")) {
    showError("Failed to load preview engine. Check your internet connection.");
  }
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = String(e?.reason?.message || e?.reason || "");
  console.error("[Preview] Unhandled rejection:", msg);
  if (msg.includes("esm.sh") || msg.includes("Sandpack") || msg.includes("Failed to fetch")) {
    showError("Failed to load preview engine. Check your internet connection.");
  }
});

startPreview();
</script>
</body>
</html>`);
});
