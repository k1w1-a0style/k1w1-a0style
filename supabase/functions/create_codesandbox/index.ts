import { serve } from "std/http/server.ts";

// CodeSandbox "define" API
const CODESANDBOX_DEFINE_URL =
  "https://codesandbox.io/api/v1/sandboxes/define?json=1";

type PreviewFile = { type?: string; contents: string };

type RequestBody = {
  name?: string;
  // Same shape as your save_preview payload
  files: Record<string, PreviewFile>;
  dependencies?: Record<string, string>;
};

type JsonRecord = Record<string, unknown>;

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init.headers ?? {}),
    },
  });
}

function safeName(name: string) {
  const n = (name || "app-preview").toLowerCase().trim();
  return (
    n
      .replace(/[^a-z0-9\-\s_]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "app-preview"
  );
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function escapeHtml(s: string) {
  return (s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function transformRNtoWeb(code: string): string {
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

function pickEntry(files: Record<string, PreviewFile>): string {
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

function buildSandboxFiles(
  name: string,
  rawFiles: Record<string, PreviewFile>,
  deps: Record<string, string>,
): Record<string, { content: string }> {
  const files: Record<string, { content: string }> = {};

  // CRA-style base
  files["package.json"] = {
    content: JSON.stringify(
      {
        name: safeName(name),
        private: true,
        version: "0.0.0",
        main: "src/index.tsx",
        dependencies: {
          react: "18.3.1",
          "react-dom": "18.3.1",
          "react-native-web": "0.19.12",

          // best-effort navigation support (works for many previews)
          "@react-navigation/native": "6.1.9",
          "@react-navigation/stack": "6.3.20",
          "react-native-gesture-handler": "2.14.0",
          "react-native-screens": "3.29.0",
          "react-native-safe-area-context": "4.8.2",

          ...deps,
        },
        devDependencies: {
          typescript: "5.3.3",
          "@types/react": "18.2.45",
          "@types/react-dom": "18.2.18",
        },
      },
      null,
      2,
    ),
  };

  files["tsconfig.json"] = {
    content: JSON.stringify(
      {
        compilerOptions: {
          jsx: "react-jsx",
          target: "ES2020",
          lib: ["DOM", "ES2020"],
          moduleResolution: "node",
          esModuleInterop: true,
          skipLibCheck: true,
          strict: false,
          baseUrl: ".",
          paths: {
            "react-native": ["node_modules/react-native-web"],
          },
        },
        include: ["src", "*.tsx", "*.ts"],
      },
      null,
      2,
    ),
  };

  files["public/index.html"] = {
    content: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no" />
  <title>${escapeHtml(name)}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body,#root{height:100%;width:100%;overflow:hidden;background:#000}
  </style>
</head>
<body>
  <div id="root"></div>
</body>
</html>`,
  };

  // Web entry
  files["src/index.tsx"] = {
    content: `import { AppRegistry } from "react-native-web";
import App from "./App";

AppRegistry.registerComponent("app", () => App);
AppRegistry.runApplication("app", {
  initialProps: {},
  rootTag: document.getElementById("root"),
});
`,
  };

  // Copy user files into /src
  for (const [p, obj] of Object.entries(rawFiles || {})) {
    const contents = obj?.contents ?? "";
    if (!contents) continue;

    const normalized = p.startsWith("src/") ? p : `src/${p}`;
    files[normalized] = { content: transformRNtoWeb(contents) };
  }

  // Ensure src/App exists
  const entry = pickEntry(rawFiles);
  const entryInSrc = entry.startsWith("src/") ? entry : `src/${entry}`;

  if (
    !files["src/App.tsx"] &&
    !files["src/App.ts"] &&
    !files["src/App.jsx"] &&
    !files["src/App.js"]
  ) {
    // If entry was some other file, make src/App re-export it
    if (files[entryInSrc]) {
      const ext =
        entryInSrc.endsWith(".js") || entryInSrc.endsWith(".jsx")
          ? "js"
          : "tsx";
      files[`src/App.${ext}`] = {
        content: `export { default } from "./${entry.replace(/^src\//, "").replace(/\.(tsx?|jsx?)$/, "")}";\n`,
      };
    } else {
      files["src/App.tsx"] = {
        content: `import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Preview ready ✅</Text>
      <Text style={styles.subtitle}>No App entry found in uploaded files.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0a" },
  title: { color: "#00ff88", fontSize: 22, fontWeight: "700", marginBottom: 8 },
  subtitle: { color: "#999", fontSize: 14 },
});
`,
      };
    }
  }

  return files;
}

function filterDeps(
  input: Record<string, string> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  const deps = input ?? {};

  const blocked = (name: string) => {
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

  for (const [k, v] of Object.entries(deps)) {
    if (typeof v !== "string") continue;
    if (blocked(k)) continue;
    // keep react 18 in browser for stability
    if (k === "react" && v.trim().startsWith("19")) continue;
    out[k] = v;
  }

  return out;
}

serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors(origin) });
  }

  if (req.method !== "POST") {
    return json(
      { ok: false, error: "Method not allowed" },
      { status: 405, headers: cors(origin) },
    );
  }

  try {
    const body = (await req.json()) as RequestBody;

    if (!body || !isObject(body) || !body.files || !isObject(body.files)) {
      return json(
        { ok: false, error: "Invalid payload: files required" },
        { status: 400, headers: cors(origin) },
      );
    }

    const name = typeof body.name === "string" ? body.name : "App Preview";
    const deps = filterDeps(body.dependencies);

    const sandboxFiles = buildSandboxFiles(name, body.files, deps);

    const resp = await fetch(CODESANDBOX_DEFINE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ files: sandboxFiles }),
    });

    const txt = await resp.text();
    if (!resp.ok) {
      throw new Error(`CodeSandbox API ${resp.status}: ${txt.slice(0, 220)}`);
    }

    const parsed = JSON.parse(txt) as JsonRecord;
    const sandboxId =
      typeof parsed.sandbox_id === "string" ? parsed.sandbox_id : "";

    if (!sandboxId) {
      throw new Error("CodeSandbox API returned no sandbox_id");
    }

    const editor = `https://codesandbox.io/s/${sandboxId}`;
    const embed =
      `https://codesandbox.io/embed/${sandboxId}` +
      `?fontsize=14&hidenavigation=1&theme=dark&view=preview&hidedevtools=1`;
    const preview = `https://${sandboxId}.csb.app/`;

    return json(
      {
        ok: true,
        sandboxId,
        urls: { editor, embed, preview },
      },
      { headers: cors(origin) },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[create_codesandbox]", msg);
    return json(
      { ok: false, error: msg },
      { status: 500, headers: cors(origin) },
    );
  }
});
