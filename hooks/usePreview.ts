// hooks/usePreview.ts
// Preview creation: prefer Supabase-hosted preview (save_preview -> preview_page).
// Fallback: local HTML via buildSandpackHtml (best-effort).

import { useCallback, useMemo, useRef, useState } from "react";
import type { ProjectData } from "../contexts/types";
import { normalizePath } from "../utils/url";
import { buildSandpackHtml } from "../lib/sandpackBuilder";
import { ensureSupabaseClient } from "../lib/supabase";
import type { PreviewFiles, PreviewResponse } from "../types/preview";

type ProjectFile = { path?: string; content?: string };

const ALLOWED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".html",
  ".htm",
  ".md",
  ".mdx",
  ".txt",
  ".svg",
  ".graphql",
  ".gql",
]);

const IGNORED_PATTERNS = [
  "node_modules/",
  ".expo/",
  ".git/",
  ".next/",
  "dist/",
  "build/",
  ".cache/",
  "__tests__/",
  "__mocks__/",
];

function isAllowedFile(path: string): boolean {
  const p = path.toLowerCase();
  if (IGNORED_PATTERNS.some((pattern) => p.includes(pattern))) return false;
  const ext = p.match(/\.[^./]+$/)?.[0];
  if (!ext) return false;
  return ALLOWED_EXTENSIONS.has(ext);
}

function safeJson<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export interface PreviewState {
  isCreating: boolean;
  lastCreatedAt: number | null;
  error: string | null;
  fileCount: number;
  totalSize: number;
}

export type PreviewResult = {
  url: string | null;
  html: string | null;
  expiresAt: string | null;
  source: "supabase" | "local";
};

export interface UsePreviewReturn {
  state: PreviewState;
  fileMap: Record<string, string>;
  dependencies: Record<string, string> | undefined;
  lastPreview: PreviewResult | null;
  createPreview: () => Promise<PreviewResult | null>;
  reset: () => void;
}

export function usePreview(projectData: ProjectData | null): UsePreviewReturn {
  const [isCreating, setIsCreating] = useState(false);
  const [lastCreatedAt, setLastCreatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastPreviewRef = useRef<PreviewResult | null>(null);

  const fileMap = useMemo(() => {
    const files: Record<string, string> = {};
    const list: ProjectFile[] = (projectData?.files as ProjectFile[]) || [];

    let total = 0;
    const MAX_SIZE = 1_500_000; // 1.5 MB local cap (save_preview has 3MB cap)

    for (const f of list) {
      const p = f?.path ? String(f.path) : "";
      if (!p) continue;
      if (!isAllowedFile(p)) continue;

      const key = normalizePath(p);
      const content = String(f?.content ?? "");
      total += content.length;

      if (total > MAX_SIZE) {
        console.warn(
          "[usePreview] ⚠️ Größen-Limit erreicht, weitere Dateien werden übersprungen",
        );
        break;
      }

      files[key] = content;
    }

    return files;
  }, [projectData]);

  const dependencies = useMemo(() => {
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

      // Keep react-native-web if present; otherwise avoid RN/expo deps in plain web Sandpack.
      if (key === "react-native-web") {
        if (typeof v === "string") out[key] = v;
        continue;
      }
      if (key === "react-native" || key.startsWith("react-native-")) continue;
      if (key === "expo" || key.startsWith("expo-")) continue;

      if (typeof v === "string") out[key] = v;
    }

    if (!out.react) out.react = "^18.2.0";
    if (!out["react-dom"]) out["react-dom"] = "^18.2.0";

    return Object.keys(out).length ? out : undefined;
  }, [fileMap]);

  const ensureMinimumFiles = useCallback(
    (files: Record<string, string>): Record<string, string> => {
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
              react: "^18.2.0",
              "react-dom": "^18.2.0",
            },
          },
          null,
          2,
        );
      }

      return out;
    },
    [],
  );

  const createPreview = useCallback(async (): Promise<PreviewResult | null> => {
    if (!projectData) {
      setError("Kein Projekt geladen.");
      return null;
    }

    setIsCreating(true);
    setError(null);

    try {
      const files = ensureMinimumFiles(fileMap);

      // 1) Prefer Supabase-hosted preview
      try {
        const supabase = await ensureSupabaseClient();

        const snackFiles: PreviewFiles = {};
        for (const [path, content] of Object.entries(files)) {
          snackFiles[path] = { contents: content };
        }

        const { data, error: fnError } = await supabase.functions.invoke(
          "save_preview",
          {
            body: {
              projectId: projectData.id,
              name: projectData.name || "Preview",
              files: snackFiles,
              dependencies,
              meta: { template: "react" },
            },
          },
        );

        if (fnError) throw fnError;

        const resp = data as PreviewResponse;
        const previewUrl =
          typeof resp?.previewUrl === "string" ? resp.previewUrl : null;

        if (resp?.ok && previewUrl) {
          const result: PreviewResult = {
            url: previewUrl,
            html: null,
            expiresAt: resp?.expiresAt ?? null,
            source: "supabase",
          };
          lastPreviewRef.current = result;
          setLastCreatedAt(Date.now());
          return result;
        }

        throw new Error(resp?.error || "Preview konnte nicht erstellt werden");
      } catch (supErr: unknown) {
        console.warn(
          "[usePreview] ⚠️ Supabase Preview fehlgeschlagen, fallback auf Local HTML:",
          supErr,
        );
      }

      // 2) Fallback: Local HTML (best-effort). If this fails too, return a clear error.
      let html: string;
      try {
        html = buildSandpackHtml({
          title: projectData.name || "Preview",
          files,
          dependencies,
        });
      } catch (e) {
        console.error("[usePreview] ❌ buildSandpackHtml failed:", e);
        setError("Local Preview konnte nicht erzeugt werden.");
        return null;
      }

      if (!html || typeof html !== "string") {
        setError("Local Preview konnte nicht erzeugt werden.");
        return null;
      }

      const fallback: PreviewResult = {
        url: null,
        html,
        expiresAt: null,
        source: "local",
      };
      lastPreviewRef.current = fallback;
      setLastCreatedAt(Date.now());
      return fallback;
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Unbekannter Fehler beim Erstellen.";
      console.error("[usePreview] ❌ Fehler:", message);
      setError(message);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [projectData, fileMap, dependencies, ensureMinimumFiles]);

  const reset = useCallback(() => {
    lastPreviewRef.current = null;
    setLastCreatedAt(null);
    setError(null);
  }, []);

  const state: PreviewState = useMemo(
    () => ({
      isCreating,
      lastCreatedAt,
      error,
      fileCount: Object.keys(fileMap).length,
      totalSize: Object.values(fileMap).reduce(
        (sum, content) => sum + content.length,
        0,
      ),
    }),
    [isCreating, lastCreatedAt, error, fileMap],
  );

  return {
    state,
    fileMap,
    dependencies,
    lastPreview: lastPreviewRef.current,
    createPreview,
    reset,
  };
}
