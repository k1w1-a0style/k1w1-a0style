// hooks/usePreview.ts
// Custom hook for preview creation logic

import { useCallback, useMemo, useRef, useState } from "react";
import type { ProjectData } from "../contexts/types";
import type { PreviewFiles } from "../types/preview";
import { normalizePath } from "../utils/url";

type ProjectFile = { path?: string; content?: string };

function isAllowedFile(path: string): boolean {
  const p = path.toLowerCase();
  if (p.includes("node_modules/")) return false;
  if (p.startsWith(".expo/")) return false;
  if (p.startsWith(".git/")) return false;

  return (
    p.endsWith(".ts") ||
    p.endsWith(".tsx") ||
    p.endsWith(".js") ||
    p.endsWith(".jsx") ||
    p.endsWith(".json") ||
    p.endsWith(".css") ||
    p.endsWith(".html") ||
    p.endsWith(".md") ||
    p.endsWith(".txt")
  );
}

function safeJson<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export function usePreview(projectData: ProjectData | null) {
  const [creating, setCreating] = useState(false);
  const [lastCreatedAt, setLastCreatedAt] = useState<number | null>(null);
  const lastHtmlRef = useRef<string | null>(null);

  const fileMap = useMemo(() => {
    const files: Record<string, string> = {};
    const list: ProjectFile[] = (projectData?.files as any) || [];

    let total = 0;
    for (const f of list) {
      const p = f?.path ? String(f.path) : "";
      if (!p) continue;
      if (!isAllowedFile(p)) continue;

      const key = normalizePath(p);
      const content = String(f?.content ?? "");
      total += content.length;

      if (total > 1_200_000) break;

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

    const pkg = safeJson<any>(pkgRaw);
    const deps =
      pkg?.dependencies && typeof pkg.dependencies === "object"
        ? pkg.dependencies
        : null;
    if (!deps) return undefined;

    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(deps)) {
      if (typeof v === "string") out[k] = v;
    }
    return Object.keys(out).length ? out : undefined;
  }, [fileMap]);

  const ensureMinimumFiles = useCallback((files: Record<string, string>) => {
    const hasIndex =
      files["/src/index.tsx"] ||
      files["/src/main.tsx"] ||
      files["/index.tsx"] ||
      files["/index.ts"];

    const hasApp =
      files["/src/App.tsx"] ||
      files["/App.tsx"] ||
      files["/src/App.ts"] ||
      files["/App.ts"];

    const hasHtml = files["/public/index.html"] || files["/index.html"];

    const out = { ...files };

    if (!hasHtml) {
      out["/public/index.html"] =
        `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Preview</title></head><body><div id="root"></div></body></html>`;
    }

    if (!hasApp) {
      out["/src/App.tsx"] = `import React from "react";
export default function App() {
  return (
    <div style={{padding:16,fontFamily:"system-ui"}}>
      <h2>Preview läuft ✅</h2>
      <p>Kein App/Web Einstieg gefunden – das ist der Default.</p>
    </div>
  );
}`;
    }

    if (!hasIndex) {
      out["/src/index.tsx"] = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
const el = document.getElementById("root");
if (el) createRoot(el).render(<App />);
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
  }, []);

  return {
    creating,
    setCreating,
    lastCreatedAt,
    setLastCreatedAt,
    lastHtmlRef,
    fileMap,
    dependencies,
    ensureMinimumFiles,
  };
}
