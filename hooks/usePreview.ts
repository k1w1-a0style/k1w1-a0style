// hooks/usePreview.ts
// Preview creation: prefer Supabase-hosted remote preview (save_preview -> preview_page) as product SoT.
// Fallback: local HTML via buildSandpackHtml remains a dev-/best-effort-only path.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useProject } from "../contexts/ProjectContext";
import { buildSandpackHtml } from "../lib/sandpackBuilder";
import { ensureSupabaseClient } from "../lib/supabase";
import { logger } from "../lib/logger";
import type { PreviewFiles } from "../types/preview";

import type { ProjectData, LastPreviewMeta } from "../shared/types/project";
import {
  describeEmptyRemotePreviewFiles,
  describeRemotePreviewFailure,
  invokeSavePreview,
  isAllowedFile,
  isProjectFile,
  safeJson,
  sanitizePreviewPath,
  shouldAttemptSupabaseFirst,
  shouldUseLocalPreviewFallback,
  simpleHash,
} from "./previewHelpers";
import type { PreviewResult, PreviewState } from "./previewHelpers";

export interface UsePreviewReturn {
  state: PreviewState;
  fileMap: Record<string, string>;
  dependencies: Record<string, string> | undefined;
  lastPreview: PreviewResult | null;
  createPreview: () => Promise<PreviewResult | null>;
  reset: () => void;
  /** Changes whenever project files change (for hot-reload detection). */
  filesFingerprint: string;
}

export function usePreview(projectData: ProjectData | null): UsePreviewReturn {
  const [isCreating, setIsCreating] = useState(false);
  const [lastCreatedAt, setLastCreatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remoteFailure, setRemoteFailure] = useState<string | null>(null);
  const { setLastPreview, setPreferredPreviewMode } = useProject();
  const [lastPreview, setLastPreviewState] = useState<PreviewResult | null>(null);

  // Hardening: prevent concurrent preview creation and avoid state updates after unmount.
  const isAliveRef = useRef(true);
  const inFlightRef = useRef<Promise<PreviewResult | null> | null>(null);

  const safeSetIsCreating = useCallback((v: boolean) => {
    if (!isAliveRef.current) return;
    setIsCreating(v);
  }, []);

  const safeSetError = useCallback((v: string | null) => {
    if (!isAliveRef.current) return;
    setError(v);
  }, []);

  const safeSetRemoteFailure = useCallback((v: string | null) => {
    if (!isAliveRef.current) return;
    setRemoteFailure(v);
  }, []);

  const safeSetLastCreatedAt = useCallback((v: number | null) => {
    if (!isAliveRef.current) return;
    setLastCreatedAt(v);
  }, []);

  const safeSetLastPreviewState = useCallback((v: PreviewResult | null) => {
    if (!isAliveRef.current) return;
    setLastPreviewState(v);
  }, []);

  // Restore last preview from persisted project data (fast toggle from header)
  useEffect(() => {
    const persisted = projectData?.lastPreview ?? null;
    setLastPreviewState((prev) => {
      if (!persisted) return null;

      const restored: PreviewResult = {
        url: persisted.url ?? null,
        html: null,
        expiresAt: persisted.expiresAt ?? null,
        source: persisted.source,
      };

      // Keep in-memory HTML only when the persisted metadata still matches.
      // This avoids stale preview carry-over when switching projects/screens.
      if (
        prev &&
        prev.url === restored.url &&
        prev.source === restored.source &&
        prev.expiresAt === restored.expiresAt
      ) {
        return prev;
      }

      return restored;
    });
  }, [
    projectData?.id,
    projectData?.lastPreview?.url,
    projectData?.lastPreview?.source,
    projectData?.lastPreview?.expiresAt,
  ]);

  useEffect(() => {
    isAliveRef.current = true;
    return () => {
      isAliveRef.current = false;
    };
  }, []);


  useEffect(() => {
    const persisted = projectData?.lastPreview ?? null;
    const isTransientLocal =
      persisted?.source === "local" &&
      lastPreview?.source === "local" &&
      !lastPreview?.html;

    if (isTransientLocal) {
      safeSetError(
        "Hinweis: Der letzte lokale HTML-/Eval-Fallback war nur temporaer und ist nach App-Neustart nicht mehr verfuegbar. Bitte die primaere Remote-Preview neu erstellen.",
      );
      return;
    }

    // Nur den transienten Hinweis zurücksetzen; andere Fehler bleiben erhalten.
    setError((prev) =>
      prev?.startsWith("Hinweis: Der letzte lokale HTML-/Eval-Fallback") ? null : prev,
    );
  }, [projectData?.lastPreview?.source, lastPreview?.source, lastPreview?.html, safeSetError]);

  const previewFiles = useMemo(() => {
    const files: Record<string, string> = {};

    const rawFiles = projectData?.files;
    const sourceList: unknown[] = Array.isArray(rawFiles) ? rawFiles : [];
    const list = sourceList.filter(isProjectFile);

    let total = 0;
    // Count malformed entries as skipped (relevant for status feedback in PreviewScreen).
    let skippedCount = sourceList.length - list.length;
    const MAX_SIZE = 1_500_000; // 1.5 MB local cap (aligned with save_preview)

    for (const [index, f] of list.entries()) {
      const p = f?.path ? String(f.path) : "";
      if (!p) {
        skippedCount += 1;
        continue;
      }
      if (!isAllowedFile(p)) {
        skippedCount += 1;
        continue;
      }

      const key = sanitizePreviewPath(p);
      if (!key) {
        skippedCount += 1;
        continue;
      }

      const content = String(f?.content ?? "");
      total += content.length;

      if (total > MAX_SIZE) {
        skippedCount += list.length - index;
        logger.warn(
          "[usePreview] ⚠️ Größen-Limit erreicht, weitere Dateien werden übersprungen",
        );
        break;
      }

      files[key] = content;
    }

    return {
      fileMap: files,
      totalSize: total,
      skippedCount,
    };
  }, [projectData?.files]);

  const { fileMap, totalSize, skippedCount } = previewFiles;

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


  const preferredMode = projectData?.preferredPreviewMode ?? "supabase";

  const attemptSupabaseFirst = shouldAttemptSupabaseFirst(preferredMode);
  const localFallbackExplicitlyEnabled = shouldUseLocalPreviewFallback(preferredMode);

  const createPreview = useCallback(async (): Promise<PreviewResult | null> => {
    // Singleflight: reuse the in-flight promise (prevents double-tap races).
    if (inFlightRef.current) return inFlightRef.current;

    const run = (async (): Promise<PreviewResult | null> => {
      if (!projectData) {
        safeSetError("Kein Projekt geladen.");
        return null;
      }

      safeSetIsCreating(true);
      safeSetError(null);
      safeSetRemoteFailure(null);

      try {
        const hasRemoteProjectFiles = Object.keys(fileMap).length > 0;
        const files = normalizeForWebPreview(ensureMinimumFiles(fileMap));
        // 1) Prefer Supabase-hosted preview (visual mode)
        if (attemptSupabaseFirst && hasRemoteProjectFiles) {
          let userJwt: string | null = null;
          try {
            const supabase = await ensureSupabaseClient();
            const sessionResult = await supabase.auth.getSession().catch(() => null);
            userJwt = String(sessionResult?.data?.session?.access_token ?? '').trim() || null;

            if (!userJwt) {
              throw new Error("Missing Supabase Preview JWT");
            }

            const snackFiles: PreviewFiles = {};
            for (const [path, content] of Object.entries(files)) {
              snackFiles[path] = { contents: String(content ?? "") };
            }

            const resolvedDependencies = dependencies ?? {};
            const dependencyCount = Object.keys(resolvedDependencies).length;
            const fileCount = Object.keys(snackFiles).length;

            const invokeOpts = {
              projectId: projectData.id,
              name: projectData.name || "Preview",
              files: snackFiles,
              dependencies: resolvedDependencies,
              meta: {
                template: "react",
                debug: {
                  source: "usePreview",
                  fileCount,
                  dependencyCount,
                },
              },
            };

            const resp = await invokeSavePreview({
              bearerJwt: userJwt,
              payload: invokeOpts,
            });
            const previewUrl =
              typeof resp?.previewUrl === "string" ? resp.previewUrl : null;

            if (resp?.ok && previewUrl) {
              const result: PreviewResult = {
                url: previewUrl,
                html: null,
                expiresAt: resp?.expiresAt ?? null,
                source: "supabase",
              };

              safeSetLastPreviewState(result);
              safeSetRemoteFailure(null);
              await setLastPreview({
                url: result.url,
                source: result.source,
                createdAt: new Date().toISOString(),
                expiresAt: result.expiresAt,
              } as LastPreviewMeta);
              if (setPreferredPreviewMode) await setPreferredPreviewMode("supabase");
              safeSetLastCreatedAt(Date.now());
              return result;
            }

            throw new Error(resp?.error || "Preview konnte nicht erstellt werden");
          } catch (supErr: unknown) {
            const statusCode =
              typeof (supErr as { status?: unknown } | null)?.status === "number"
                ? Number((supErr as { status?: number }).status)
                : null;
            safeSetRemoteFailure(
              describeRemotePreviewFailure({
                bearerJwt: userJwt,
                statusCode,
                error: supErr,
              }),
            );
            logger.warn("[usePreview] ⚠️ Supabase Preview fehlgeschlagen", supErr);
          }
        } else if (attemptSupabaseFirst) {
          safeSetRemoteFailure(
            describeEmptyRemotePreviewFiles({
              projectFileCount: Array.isArray(projectData.files) ? projectData.files.length : 0,
              allowedFileCount: Object.keys(fileMap).length,
              skippedCount,
            }),
          );
        }

        if (!localFallbackExplicitlyEnabled) {
          throw new Error(
            "Remote-Preview im Standardpfad nicht verfuegbar. Entweder fehlt ein gueltiger Supabase-Login-JWT fuer save_preview oder der Edge-Call ist fehlgeschlagen; lokaler HTML-/Eval-Fallback bleibt nur im expliziten Local-/Dev-Modus.",
          );
        }

        // 2) Explicit local mode only: local HTML/Eval preview for dev/best-effort.
        let html: string;
        try {
          html = buildSandpackHtml({
            title: projectData.name || "Preview",
            files,
            dependencies,
          });
        } catch (e) {
          logger.error("[usePreview] buildSandpackHtml failed", { err: e });
          safeSetError("Lokaler Dev-Fallback konnte nicht erzeugt werden.");
          return null;
        }

        if (!html || typeof html !== "string") {
          safeSetError("Lokaler Dev-Fallback konnte nicht erzeugt werden.");
          return null;
        }

        const fallback: PreviewResult = {
          url: null,
          html,
          expiresAt: null,
          source: "local",
        };

        safeSetLastPreviewState(fallback);
        await setLastPreview({
          url: fallback.url,
          source: fallback.source,
          createdAt: new Date().toISOString(),
          expiresAt: fallback.expiresAt,
        } as LastPreviewMeta);
        safeSetLastCreatedAt(Date.now());
        return fallback;
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : "Unbekannter Fehler beim Erstellen.";
        logger.error("[usePreview] Fehler", { message });
        safeSetError(message);
        throw new Error(message);
      } finally {
        safeSetIsCreating(false);
      }
    })();

    inFlightRef.current = run;
    return run.finally(() => {
      // Ensure the lock is released even if the component unmounted.
      inFlightRef.current = null;
    });
  }, [
    projectData,
    fileMap,
    dependencies,
    ensureMinimumFiles,
    normalizeForWebPreview,
    safeSetError,
    safeSetIsCreating,
    safeSetLastCreatedAt,
    safeSetLastPreviewState,
    setLastPreview,
    setPreferredPreviewMode,
    preferredMode,
    attemptSupabaseFirst,
    localFallbackExplicitlyEnabled,
  ]);

  const reset = useCallback(() => {
    safeSetLastPreviewState(null);
    void setLastPreview(null);
    safeSetLastCreatedAt(null);
    safeSetError(null);
    safeSetRemoteFailure(null);
  }, [setLastPreview, safeSetError, safeSetLastCreatedAt, safeSetLastPreviewState, safeSetRemoteFailure]);

  const state: PreviewState = useMemo(
    () => ({
      isCreating,
      lastCreatedAt,
      error,
      remoteFailure,
      fileCount: Object.keys(fileMap).length,
      totalSize,
      skippedCount,
    }),
    [isCreating, lastCreatedAt, error, remoteFailure, fileMap, totalSize, skippedCount],
  );

  // Content-aware fingerprint: key + per-file content hash (same-length edits are detected).
  const filesFingerprint = useMemo(() => {
    const keys = Object.keys(fileMap).sort();
    const totalLen = Object.values(fileMap).reduce((sum, content) => sum + content.length, 0);
    const fileHashes = keys.map((key) => `${key}:${simpleHash(fileMap[key] ?? "")}`).join("|");
    return `${keys.length}-${totalLen}-${simpleHash(fileHashes)}`;
  }, [fileMap]);

  return {
    state,
    fileMap,
    dependencies,
    lastPreview,
    createPreview,
    reset,
    filesFingerprint,
  };
}
