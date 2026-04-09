import { logger } from "../lib/logger";
import type { LastPreviewMeta, ProjectData } from "../shared/types/project";
import { describeEmptyRemotePreviewFiles, type PreviewResult } from "./previewHelpers";
import { PREVIEW_REMOTE_FAIL_CLOSED_MESSAGE } from "./usePreviewFlowHelpers";
import { createLocalFallbackPreview, tryCreateSupabasePreview, type PreviewStateSetters } from "./usePreviewCreation";

export async function executePreviewCreation(params: {
  projectData: ProjectData | null;
  fileMap: Record<string, string>;
  filesForWeb: Record<string, string>;
  dependencies: Record<string, string> | undefined;
  skippedCount: number;
  attemptSupabaseFirst: boolean;
  localFallbackExplicitlyEnabled: boolean;
  setLastPreview: (meta: LastPreviewMeta | null) => Promise<void>;
  setPreferredPreviewMode?: (mode: "supabase" | "local") => Promise<void>;
  setters: PreviewStateSetters;
}): Promise<PreviewResult | null> {
  const {
    projectData,
    fileMap,
    filesForWeb,
    dependencies,
    skippedCount,
    attemptSupabaseFirst,
    localFallbackExplicitlyEnabled,
    setLastPreview,
    setPreferredPreviewMode,
    setters,
  } = params;

  if (!projectData) {
    setters.setError("Kein Projekt geladen.");
    return null;
  }

  const hasRemoteProjectFiles = Object.keys(fileMap).length > 0;

  if (attemptSupabaseFirst && hasRemoteProjectFiles) {
    const { result } = await tryCreateSupabasePreview({
      projectData,
      files: filesForWeb,
      dependencies,
      setLastPreview: (meta) => setLastPreview(meta),
      setPreferredPreviewMode,
      setters,
    });
    if (result) return result;
  } else if (attemptSupabaseFirst) {
    setters.setRemoteFailure(
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

  return createLocalFallbackPreview({
    projectData,
    files: filesForWeb,
    dependencies,
    setLastPreview: (meta) => setLastPreview(meta),
    setters,
  });
}

export function normalizePreviewCreationError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unbekannter Fehler beim Erstellen.";
  logger.error("[usePreview] Fehler", { message });
  return message;
}
