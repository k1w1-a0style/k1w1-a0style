// supabase/functions/create_codesandbox/helpers.ts
// Extracted from create_codesandbox/index.ts: utility functions.

// NOTE: Supabase Edge (Deno) bundler requires explicit file extensions for local imports.
import { sanitizeErrorText as sanitizeErrorTextLocal } from "../_shared/errorSanitization.ts";
export { sanitizeErrorText, sanitizeUnknownForTransport } from "../_shared/errorSanitization.ts";
export { parseJsonBody } from "../_shared/validation.ts";
export { requireScopedEdgeAuth, rateLimit } from "../_shared/auth.ts";

// CodeSandbox "define" API

export const CODESANDBOX_DEFINE_URL =
  "https://codesandbox.io/api/v1/sandboxes/define?json=1";

export type PreviewFile = { type?: string; contents: string };

export type RequestBody = {
  name?: string;
  // Same shape as your save_preview payload
  files: Record<string, PreviewFile>;
  dependencies?: Record<string, string>;
};

export type JsonRecord = Record<string, unknown>;

export function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init.headers ?? {}),
    },
  });
}

export function safeErrorMessage(err: unknown): string {
  if (typeof err === "string") return sanitizeErrorTextLocal(err);
  if (err && typeof err === "object" && "message" in err) {
    try {
      const message = err.message;
      return sanitizeErrorTextLocal(String(message));
    } catch {
      return "Unknown error";
    }
  }
  return "Unknown error";
}

export function safeName(name: string) {
  const n = (name || "app-preview").toLowerCase().trim();
  return (
    n
      .replace(/[^a-z0-9\-\s_]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "app-preview"
  );
}

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function escapeHtml(s: string) {
  return (s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function transformRNtoWeb(code: string): string {
  if (typeof code !== "string") return "";
  let result = code;

  // react-native -> react-native-web
  result = result.replace(
    /from\s+["']react-native["']/g,
    'from "react-native-web"',
  );

  // native-stack -> stack (web friendly)
  result = result.replace(
    /@react-navigation\/native-stack/g,
    "@react-navigation/stack",
  );
  result = result.replace(
    /createNativeStackNavigator/g,
    "createStackNavigator",
  );

  // Remove expo-status-bar
  result = result.replace(
    /import\s+(?:\{[^}]*\}|[^;]+)\s+from\s+["']expo-status-bar["'];?\n?/g,
    "",
  );
  result = result.replace(/<StatusBar[^>]*\/>/g, "");

  // Remove @expo/vector-icons (fallback dot)
  result = result.replace(
    /import\s*\{[^}]+\}\s*from\s*["']@expo\/vector-icons["'];?\n?/g,
    "// @expo/vector-icons removed for web\n",
  );
  result = result.replace(
    /import\s+\w+\s+from\s*["']@expo\/vector-icons\/\w+["'];?\n?/g,
    "// @expo/vector-icons removed for web\n",
  );
  result = result.replace(
    /<(?:Ionicons|MaterialIcons|FontAwesome|Feather|AntDesign|Entypo|MaterialCommunityIcons|FontAwesome5|Fontisto|Foundation|Octicons|Zocial|SimpleLineIcons|EvilIcons)[^>]*\/>/g,
    "<span style={{fontSize:16}}>●</span>",
  );

  // AsyncStorage -> localStorage (best-effort)
  result = result.replace(
    /import\s+AsyncStorage\s+from\s*["']@react-native-async-storage\/async-storage["'];?/g,
    `const AsyncStorage = {
  getItem: async (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: async (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
  removeItem: async (k: string) => { try { localStorage.removeItem(k); } catch {} },
  clear: async () => { try { localStorage.clear(); } catch {} },
};`,
  );

  return result;
}

export function pickEntry(files: Record<string, PreviewFile>): string {
  const candidates = [
    "index.tsx",
    "index.ts",
    "index.jsx",
    "index.js",
    "App.tsx",
    "App.ts",
    "App.jsx",
    "App.js",
    "src/App.tsx",
    "src/App.ts",
    "src/App.jsx",
    "src/App.js",
  ];

  for (const c of candidates) {
    if (files[c]?.contents) return c;
  }

  const first = Object.keys(files || {})[0];
  return first || "App.tsx";
}
