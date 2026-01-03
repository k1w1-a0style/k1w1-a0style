// hooks/usePreview.ts
// Custom hook for preview creation logic

import { useCallback, useMemo, useRef, useState } from "react";
import type { ProjectData } from "../contexts/types";
import { normalizePath } from "../utils/url";
import { buildSandpackHtml } from "../lib/sandpackBuilder";

type ProjectFile = { path?: string; content?: string };

// Erlaubte Dateitypen für Preview
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

// Ignorierte Pfade
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

  // Prüfe ignorierte Patterns
  if (IGNORED_PATTERNS.some((pattern) => p.includes(pattern))) {
    return false;
  }

  // Prüfe Erweiterung
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

export interface UsePreviewReturn {
  /** Aktueller Preview-Status */
  state: PreviewState;
  /** Generierte File-Map für Sandpack */
  fileMap: Record<string, string>;
  /** Extrahierte Dependencies aus package.json */
  dependencies: Record<string, string> | undefined;
  /** Zuletzt generiertes HTML (für Re-Open) */
  lastHtml: string | null;
  /** Preview erstellen und HTML generieren */
  createPreview: () => Promise<string | null>;
  /** Preview zurücksetzen */
  reset: () => void;
}

/**
 * Hook für Preview-Erstellung mit Sandpack
 */
export function usePreview(projectData: ProjectData | null): UsePreviewReturn {
  const [isCreating, setIsCreating] = useState(false);
  const [lastCreatedAt, setLastCreatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastHtmlRef = useRef<string | null>(null);

  // File-Map aus Projekt-Dateien erstellen
  const fileMap = useMemo(() => {
    const files: Record<string, string> = {};
    const list: ProjectFile[] = (projectData?.files as ProjectFile[]) || [];

    let total = 0;
    const MAX_SIZE = 1_500_000; // 1.5 MB Limit

    for (const f of list) {
      const p = f?.path ? String(f.path) : "";
      if (!p) continue;
      if (!isAllowedFile(p)) continue;

      const key = normalizePath(p);
      const content = String(f?.content ?? "");
      total += content.length;

      // Größen-Limit prüfen
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

  // Dependencies aus package.json extrahieren
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
      // React-Native spezifische Packages ausfiltern (funktionieren nicht in Sandpack)
      if (k.includes("react-native") || k.includes("expo-")) continue;
      if (typeof v === "string") out[k] = v;
    }

    // Immer React und React-DOM hinzufügen falls nicht vorhanden
    if (!out.react) out.react = "^18.2.0";
    if (!out["react-dom"]) out["react-dom"] = "^18.2.0";

    return Object.keys(out).length ? out : undefined;
  }, [fileMap]);

  // Minimale Dateien sicherstellen
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

      // HTML Template
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

      // Default App-Komponente
      if (!hasApp) {
        out["/src/App.tsx"] = `import React from "react";

export default function App() {
  return (
    <div style={{ 
      padding: 24, 
      fontFamily: "system-ui", 
      maxWidth: 600, 
      margin: "0 auto" 
    }}>
      <h1 style={{ color: "#00ff88", marginBottom: 8 }}>Preview läuft ✅</h1>
      <p style={{ color: "#888", lineHeight: 1.5 }}>
        Kein App-Einstiegspunkt gefunden. Dies ist eine Standard-Vorschau.
      </p>
      <p style={{ color: "#666", fontSize: 14, marginTop: 16 }}>
        Erstelle eine <code>/src/App.tsx</code> oder <code>/App.tsx</code> Datei
        um deine eigene App anzuzeigen.
      </p>
    </div>
  );
}`;
      }

      // Entry-Point
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

      // package.json
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

  // Preview erstellen
  const createPreview = useCallback(async (): Promise<string | null> => {
    if (!projectData) {
      setError("Kein Projekt geladen.");
      return null;
    }

    setIsCreating(true);
    setError(null);

    try {
      const files = ensureMinimumFiles(fileMap);

      const html = buildSandpackHtml({
        title: projectData.name || "Preview",
        files,
        dependencies,
      });

      lastHtmlRef.current = html;
      setLastCreatedAt(Date.now());

      console.log(
        `[usePreview] ✅ Preview erstellt: ${Object.keys(files).length} Dateien`,
      );

      return html;
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

  // Reset
  const reset = useCallback(() => {
    lastHtmlRef.current = null;
    setLastCreatedAt(null);
    setError(null);
  }, []);

  // State-Objekt
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
    lastHtml: lastHtmlRef.current,
    createPreview,
    reset,
  };
}
