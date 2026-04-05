import type { ProjectData } from "../shared/types/project";
import type { PreviewFiles } from "../types/preview";

import { safeJson } from "./previewHelpers";

export const PREVIEW_REMOTE_FAIL_CLOSED_MESSAGE =
  "Remote-Preview im Standardpfad nicht verfuegbar. Entweder fehlt ein gueltiger Supabase-Login-JWT fuer save_preview oder der Edge-Call ist fehlgeschlagen; lokaler HTML-/Eval-Fallback bleibt nur im expliziten Local-/Dev-Modus.";

const PREVIEW_MAX_TOTAL_SIZE = 1_500_000;

export function buildPreviewDependencies(fileMap: Record<string, string>): Record<string, string> | undefined {
  const pkgRaw =
    fileMap["/package.json"] ||
    fileMap["/app/package.json"] ||
    fileMap["/src/package.json"];

  if (!pkgRaw) return undefined;

  const pkg = safeJson<{ dependencies?: Record<string, unknown> }>(pkgRaw);
  const deps = pkg?.dependencies;
  if (!deps || typeof deps !== "object") return undefined;

  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(deps)) {
    const key = String(k);

    if (key === "react-native-web") {
      if (typeof v === "string") out[key] = v;
      continue;
    }
    if (key === "react-native" || key.startsWith("react-native-")) continue;
    if (key === "expo" || key.startsWith("expo-")) continue;

    if (typeof v === "string") out[key] = v;
  }

  if (!out.react) out.react = "^19.1.0";
  if (!out["react-dom"]) out["react-dom"] = "^19.1.0";

  const needsRNW = Object.values(fileMap).some((content) =>
    typeof content === "string" &&
    (content.includes('from "react-native"') ||
      content.includes("from 'react-native'") ||
      content.includes('require("react-native")') ||
      content.includes("require('react-native')")),
  );

  if (needsRNW && !out["react-native-web"]) {
    out["react-native-web"] = "^0.21.1";
  }

  return Object.keys(out).length ? out : undefined;
}

export function ensureMinimumPreviewFiles(files: Record<string, string>): Record<string, string> {
  const hasIndex =
    files["/src/index.tsx"] ||
    files["/src/main.tsx"] ||
    files["/index.tsx"] ||
    files["/index.ts"] ||
    files["/src/index.js"] ||
    files["/src/main.js"];

  const hasApp =
    files["/src/App.tsx"] ||
    files["/App.tsx"] ||
    files["/src/App.ts"] ||
    files["/App.ts"] ||
    files["/src/App.jsx"] ||
    files["/App.jsx"];

  const hasHtml = files["/public/index.html"] || files["/index.html"];

  const out = { ...files };

  if (!hasHtml) {
    out["/public/index.html"] = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Preview</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;
  }

  if (!hasApp) {
    out["/src/App.tsx"] = `import React from "react";

export default function App() {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ color: "#00ff88", marginBottom: 8 }}>Preview läuft ✅</h1>
      <p style={{ color: "#888", lineHeight: 1.5 }}>
        Kein App-Einstiegspunkt gefunden. Dies ist eine Standard-Vorschau.
      </p>
      <p style={{ color: "#666", fontSize: 14, marginTop: 16 }}>
        Lege <code>/src/App.tsx</code> oder <code>/App.tsx</code> an, um deine App zu sehen.
      </p>
    </div>
  );
}`;
  }

  if (!hasIndex) {
    out["/src/index.tsx"] = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
`;
  }

  if (!out["/package.json"]) {
    out["/package.json"] = JSON.stringify(
      {
        name: "preview",
        version: "1.0.0",
        private: true,
        dependencies: {
          react: "^19.1.0",
          "react-dom": "^19.1.0",
        },
      },
      null,
      2,
    );
  }

  return out;
}

export function normalizePreviewFilesForWeb(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...files };

  const replaceImports = (source: string): string => {
    let value = source;
    value = value.replace(/from\s+['"]react-native['"]/g, 'from "react-native-web"');
    value = value.replace(/require\(\s*['"]react-native['"]\s*\)/g, 'require("react-native-web")');
    return value;
  };

  for (const [path, content] of Object.entries(out)) {
    if (typeof content !== "string") continue;
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(path)) continue;
    out[path] = replaceImports(content);
  }

  return out;
}

export function buildSnackPreviewFiles(files: Record<string, string>): PreviewFiles {
  const snackFiles: PreviewFiles = {};
  for (const [path, content] of Object.entries(files)) {
    snackFiles[path] = { contents: String(content ?? "") };
  }
  return snackFiles;
}

export function extractSessionAccessToken(sessionResult: unknown): string | null {
  const token = (sessionResult as { data?: { session?: { access_token?: unknown } } } | null)
    ?.data?.session?.access_token;
  return typeof token === "string" && token.trim() ? token.trim() : null;
}

export function getErrorStatusCode(error: unknown): number | null {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? Number(status) : null;
}

export function buildPreviewFileMap(projectData: ProjectData | null, options: {
  isProjectFile: (value: unknown) => boolean;
  isAllowedFile: (path: string) => boolean;
  sanitizePreviewPath: (raw: string) => string | null;
  onSizeLimitExceeded?: () => void;
}): { fileMap: Record<string, string>; totalSize: number; skippedCount: number } {
  const files: Record<string, string> = {};

  const rawFiles = projectData?.files;
  const sourceList: unknown[] = Array.isArray(rawFiles) ? rawFiles : [];
  const list = sourceList.filter(options.isProjectFile) as Array<{ path?: string; content?: string }>;

  let total = 0;
  let skippedCount = sourceList.length - list.length;

  for (const [index, file] of list.entries()) {
    const path = file?.path ? String(file.path) : "";
    if (!path) {
      skippedCount += 1;
      continue;
    }
    if (!options.isAllowedFile(path)) {
      skippedCount += 1;
      continue;
    }

    const key = options.sanitizePreviewPath(path);
    if (!key) {
      skippedCount += 1;
      continue;
    }

    const content = String(file?.content ?? "");
    total += content.length;

    if (total > PREVIEW_MAX_TOTAL_SIZE) {
      skippedCount += list.length - index;
      options.onSizeLimitExceeded?.();
      break;
    }

    files[key] = content;
  }

  return {
    fileMap: files,
    totalSize: total,
    skippedCount,
  };
}
