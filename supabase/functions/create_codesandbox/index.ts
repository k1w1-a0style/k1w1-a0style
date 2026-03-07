// supabase/functions/create_codesandbox/index.ts
// REFACTORED: helpers → helpers.ts

import {
  CODESANDBOX_DEFINE_URL, cors, json, safeErrorMessage, safeName,
  isObject, escapeHtml, transformRNtoWeb, pickEntry,
  parseJsonBody, rateLimit, requireAdminKey, sanitizeUnknownForTransport, serve,
} from "./helpers.ts";
import type { PreviewFile, RequestBody, JsonRecord } from "./helpers.ts";

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
  const auth = requireAdminKey(req);
  if (auth) return auth;

  const rl = rateLimit(req, "create_codesandbox");
  if (rl) return rl;

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
    const parsedBody = await parseJsonBody(req, 2_000_000);
    if (!parsedBody.ok) {
      const status = parsedBody.error.includes("too large") ? 413 : 400;
      return json(
        { ok: false, error: sanitizeErrorText(parsedBody.error) },
        { status, headers: cors(origin) },
      );
    }
    const body = parsedBody.body as RequestBody;

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
    const msg = safeErrorMessage(e);
    console.error("[create_codesandbox]", msg);
    return json(
      {
        ok: false,
        error: "Internal error",
        details: sanitizeUnknownForTransport(msg),
      },
      { status: 500, headers: cors(origin) },
    );
  }
});
