// hooks/usePreview.ts
// Preview creation: prefer Supabase-hosted preview (save_preview -> preview_page).
// Fallback: local HTML via buildSandpackHtml (best-effort).

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectData, LastPreviewMeta } from "../contexts/types";
import { useProject } from "../contexts/ProjectContext";
import { buildSandpackHtml } from "../lib/sandpackBuilder";
import { ensureSupabaseClient } from "../lib/supabase";
import { getEdgeAdminKey } from "../contexts/githubService";
import type { PreviewFiles, PreviewResponse } from "../types/preview";

function promiseWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });
  return (Promise.race([promise, timeoutPromise]) as Promise<T>).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

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

function sanitizePreviewPath(raw: string): string | null {
  let p = String(raw ?? "")
    .trim()
    .replace(/\\/g, "/");
  if (!p) return null;
  if (p.length > 300) return null;
  if (p.includes("\0")) return null;

  const segs = p.split("/").filter(Boolean);
  if (segs.some((s) => s === "..")) return null;

  // Collapse multiple slashes
  p = p.replace(/\/+/g, "/");
  if (!p.startsWith("/")) p = "/" + p;
  return p;
}

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
  const { setLastPreview } = useProject();
  const [lastPreview, setLastPreviewState] = useState<PreviewResult | null>(null);

  // Restore last preview from persisted project data (fast toggle from header)
  useEffect(() => {
    const persisted = projectData?.lastPreview ?? null;
    if (!persisted) return;
    setLastPreviewState((prev) => {
      if (prev) return prev;
      return {
        url: persisted.url ?? null,
        html: null,
        expiresAt: persisted.expiresAt ?? null,
        source: persisted.source,
      };
    });
  }, [projectData?.lastPreview?.url, projectData?.lastPreview?.source]);


  const fileMap = useMemo(() => {
    const files: Record<string, string> = {};

    const rawFiles = projectData?.files;
    const list: ProjectFile[] = Array.isArray(rawFiles)
      ? (rawFiles.filter((f: any) => {
          if (!f || typeof f !== "object") return false;
          const p = (f as any).path;
          const c = (f as any).content;
          return typeof p === "string" && typeof c === "string";
        }) as ProjectFile[])
      : [];

    let total = 0;
    const MAX_SIZE = 1_500_000; // 1.5 MB local cap (aligned with save_preview)

    for (const f of list) {
      const p = f?.path ? String(f.path) : "";
      if (!p) continue;
      if (!isAllowedFile(p)) continue;

      const key = sanitizePreviewPath(p);
      if (!key) continue;

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

    // Default minimal web deps
    if (!out.react) out.react = "^19.1.0";
    if (!out["react-dom"]) out["react-dom"] = "^19.1.0";

    // If project code imports react-native, include RNW.
    const needsRNW = Object.values(fileMap ?? {}).some((c) =>
      typeof c === "string" &&
      (c.includes('from "react-native"') ||
        c.includes("from 'react-native'") ||
        c.includes('require("react-native")') ||
        c.includes("require('react-native')")),
    );

    if (needsRNW && !out["react-native-web"]) {
      out["react-native-web"] = "^0.21.1";
    }

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
              react: "^19.1.0",
              "react-dom": "^19.1.0",
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

  const normalizeForWebPreview = useCallback(
    (files: Record<string, string>): Record<string, string> => {
      const out: Record<string, string> = { ...files };

      const replaceImports = (s: string) => {
        let x = s;
        // Web Sandpack kann kein RN-Bundler-Alias: ersetze react-native -> react-native-web (Preview-only).
        x = x.replace(/from\s+['"]react-native['"]/g, 'from "react-native-web"');
        x = x.replace(
          /require\(\s*['"]react-native['"]\s*\)/g,
          'require("react-native-web")',
        );
        return x;
      };

      for (const [p, c] of Object.entries(out)) {
        if (typeof c !== "string") continue;
        if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(p)) continue;
        out[p] = replaceImports(c);
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
      const files = normalizeForWebPreview(ensureMinimumFiles(fileMap));

      // 1) Prefer Supabase-hosted preview
      try {
        const supabase = await ensureSupabaseClient();
        const edgeAdminKey = await getEdgeAdminKey().catch(() => null);

        // Security: save_preview is protected by an admin key. If it's not configured,
        // skip the remote preview path immediately to avoid unnecessary 401 calls.
        if (!edgeAdminKey) {
          throw new Error("Missing Edge Admin Key");
        }

        const snackFiles: PreviewFiles = {};
        for (const [path, content] of Object.entries(files)) {
          const text = typeof content === "string" ? content : String((content as any) ?? "");
          snackFiles[path] = { contents: text };
        }

        const invokeOpts: any = {
          body: {
            projectId: projectData.id,
            name: projectData.name || "Preview",
            files: snackFiles,
            dependencies,
            meta: { template: "react" },
          },
        };

        if (edgeAdminKey) {
          invokeOpts.headers = { "x-k1w1-admin-key": edgeAdminKey };
        }

        const { data, error: fnError } = await promiseWithTimeout(
          supabase.functions.invoke("save_preview", invokeOpts),
          12_000,
          "Supabase Preview Timeout (12s)",
        );

        if (fnError) throw fnError;

        const resp = data as PreviewResponse;
        const previewUrl = typeof resp?.previewUrl === "string" ? resp.previewUrl : null;

        if (resp?.ok && previewUrl) {
          const result: PreviewResult = {
            url: previewUrl,
            html: null,
            expiresAt: resp?.expiresAt ?? null,
            source: "supabase",
          };
          setLastPreviewState(result);
          await setLastPreview({
            url: result.url,
            source: result.source,
            createdAt: new Date().toISOString(),
            expiresAt: result.expiresAt,
          } as LastPreviewMeta);
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

      // 2) Fallback: Local HTML (best-effort)
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
      setLastPreviewState(fallback);
      await setLastPreview({
        url: fallback.url,
        source: fallback.source,
        createdAt: new Date().toISOString(),
        expiresAt: fallback.expiresAt,
      } as LastPreviewMeta);
      setLastCreatedAt(Date.now());
      return fallback;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unbekannter Fehler beim Erstellen.";
      console.error("[usePreview] ❌ Fehler:", message);
      setError(message);
      throw new Error(message);
    } finally {
      setIsCreating(false);
    }
  }, [projectData, fileMap, dependencies, ensureMinimumFiles, normalizeForWebPreview]);

    const reset = useCallback(() => {
    setLastPreviewState(null);
    void setLastPreview(null);
    setLastCreatedAt(null);
    setError(null);
  }, [setLastPreview]);

  const state: PreviewState = useMemo(
    () => ({
      isCreating,
      lastCreatedAt,
      error,
      fileCount: Object.keys(fileMap).length,
      totalSize: Object.values(fileMap).reduce((sum, content) => sum + content.length, 0),
    }),
    [isCreating, lastCreatedAt, error, fileMap],
  );

  return {
    state,
    fileMap,
    dependencies,
    lastPreview,
    createPreview,
    reset,
  };
}