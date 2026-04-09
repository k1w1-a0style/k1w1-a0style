// hooks/usePreview.ts
// Preview creation: prefer Supabase-hosted remote preview (save_preview -> preview_page) as product SoT.
// Fallback: local HTML via buildSandpackHtml remains a dev-/best-effort-only path.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useProject } from "../contexts/ProjectContext";
import type { ProjectData, LastPreviewMeta } from "../shared/types/project";
import {
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
  ensureMinimumPreviewFiles,
  normalizePreviewFilesForWeb,
} from "./usePreviewFlowHelpers";
import { executePreviewCreation, normalizePreviewCreationError } from "./usePreviewExecution";

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
          console.warn("[usePreview] ⚠️ Größen-Limit erreicht, weitere Dateien werden übersprungen");
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
        const filesForWeb = normalizePreviewFilesForWeb(ensureMinimumPreviewFiles(fileMap));
        return await executePreviewCreation({
          projectData,
          fileMap,
          filesForWeb,
          dependencies,
          skippedCount,
          attemptSupabaseFirst,
          localFallbackExplicitlyEnabled,
          setLastPreview: (meta) => setLastPreview(meta as LastPreviewMeta),
          setPreferredPreviewMode,
          setters: {
            setLastPreviewState: safeSetLastPreviewState,
            setRemoteFailure: safeSetRemoteFailure,
            setError: safeSetError,
            setLastCreatedAt: safeSetLastCreatedAt,
          },
        });
      } catch (e: unknown) {
        const message = normalizePreviewCreationError(e);
        safeSetError(message);
        throw new Error(message);
      } finally {
        safeSetIsCreating(false);
      }
    })();

    inFlightRef.current = run;
    return run.finally(() => {
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
