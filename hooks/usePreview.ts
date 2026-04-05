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
  sanitizePreviewPath,
  shouldAttemptSupabaseFirst,
  shouldUseLocalPreviewFallback,
  simpleHash,
} from "./previewHelpers";
import type { PreviewResult, PreviewState } from "./previewHelpers";
import {
  buildPreviewDependencies,
  buildPreviewFileMap,
  buildSnackPreviewFiles,
  ensureMinimumPreviewFiles,
  extractSessionAccessToken,
  getErrorStatusCode,
  normalizePreviewFilesForWeb,
  PREVIEW_REMOTE_FAIL_CLOSED_MESSAGE,
} from "./usePreviewFlowHelpers";

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

  const previewFiles = useMemo(
    () =>
      buildPreviewFileMap(projectData, {
        isProjectFile,
        isAllowedFile,
        sanitizePreviewPath,
        onSizeLimitExceeded: () => {
          logger.warn(
            "[usePreview] ⚠️ Größen-Limit erreicht, weitere Dateien werden übersprungen",
          );
        },
      }),
    [projectData],
  );

  const { fileMap, totalSize, skippedCount } = previewFiles;

  const dependencies = useMemo(() => buildPreviewDependencies(fileMap), [fileMap]);

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
        const files = normalizePreviewFilesForWeb(ensureMinimumPreviewFiles(fileMap));

        // 1) Prefer Supabase-hosted preview (visual mode)
        if (attemptSupabaseFirst && hasRemoteProjectFiles) {
          let userJwt: string | null = null;
          try {
            const supabase = await ensureSupabaseClient();
            const sessionResult = await supabase.auth.getSession().catch(() => null);
            userJwt = extractSessionAccessToken(sessionResult);

            if (!userJwt) {
              throw new Error("Missing Supabase Preview JWT");
            }

            const snackFiles: PreviewFiles = buildSnackPreviewFiles(files);
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
            safeSetRemoteFailure(
              describeRemotePreviewFailure({
                bearerJwt: userJwt,
                statusCode: getErrorStatusCode(supErr),
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
          throw new Error(PREVIEW_REMOTE_FAIL_CLOSED_MESSAGE);
        }

        // 2) Explicit local mode only: local HTML/Eval preview for dev/best-effort.
        let html: string;
        try {
          html = buildSandpackHtml({
            title: projectData.name || "Preview",
            files,
            dependencies,
            allowUnsafeLocalEval:
              (typeof __DEV__ !== "undefined" && __DEV__) || process.env.NODE_ENV === "test",
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
    safeSetError,
    safeSetIsCreating,
    safeSetLastCreatedAt,
    safeSetLastPreviewState,
    setLastPreview,
    setPreferredPreviewMode,
    preferredMode,
    attemptSupabaseFirst,
    localFallbackExplicitlyEnabled,
    skippedCount,
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
