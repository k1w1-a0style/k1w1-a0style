import { buildSandpackHtml } from "../lib/sandpackBuilder";
import { ensureSupabaseClient } from "../lib/supabase";
import { logger } from "../lib/logger";
import type { LastPreviewMeta, ProjectData } from "../shared/types/project";
import type { PreviewFiles } from "../types/preview";
import {
  describeRemotePreviewFailure,
  invokeSavePreview,
} from "./previewHelpers";
import type { PreviewResult } from "./previewHelpers";
import {
  buildSnackPreviewFiles,
  extractSessionAccessToken,
  getErrorStatusCode,
} from "./usePreviewFlowHelpers";

function isExplicitUnsafeLocalPreviewEvalEnabled(): boolean {
  const envOptIn = process.env.EXPO_PUBLIC_ENABLE_UNSAFE_LOCAL_PREVIEW_EVAL === "true";
  const isDevRuntime = (typeof __DEV__ !== "undefined" && __DEV__) || process.env.NODE_ENV === "test";
  return envOptIn && isDevRuntime;
}

export type PreviewStateSetters = {
  setLastPreviewState: (value: PreviewResult | null) => void;
  setRemoteFailure: (value: string | null) => void;
  setError: (value: string | null) => void;
  setLastCreatedAt: (value: number | null) => void;
};

export const tryCreateSupabasePreview = async ({
  projectData,
  files,
  dependencies,
  setLastPreview,
  setPreferredPreviewMode,
  setters,
}: {
  projectData: ProjectData;
  files: Record<string, string>;
  dependencies: Record<string, string> | undefined;
  setLastPreview: (meta: LastPreviewMeta) => Promise<void>;
  setPreferredPreviewMode?: (mode: "supabase" | "local") => Promise<void>;
  setters: PreviewStateSetters;
}): Promise<{ result: PreviewResult | null; handledFailure: boolean }> => {
  let userJwt: string | null = null;
  try {
    const supabase = await ensureSupabaseClient().catch((error: unknown) => {
      const message = error instanceof Error && error.message.trim() ? error.message.trim() : String(error);
      throw new Error(`Supabase preview init failed: ${message}`);
    });
    const sessionResult = await supabase.auth.getSession().catch((error: unknown) => {
      const message = error instanceof Error && error.message.trim() ? error.message.trim() : String(error);
      throw new Error(`Supabase session unreadable: ${message}`);
    });
    userJwt = extractSessionAccessToken(sessionResult);

    if (!userJwt) {
      throw new Error("Missing Supabase Preview JWT");
    }

    const snackFiles: PreviewFiles = buildSnackPreviewFiles(files);
    const resolvedDependencies = dependencies ?? {};
    const dependencyCount = Object.keys(resolvedDependencies).length;
    const fileCount = Object.keys(snackFiles).length;

    const resp = await invokeSavePreview({
      bearerJwt: userJwt,
      payload: {
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
      },
    });

    const previewUrl = typeof resp?.previewUrl === "string" ? resp.previewUrl : null;
    if (resp?.ok && previewUrl) {
      const result: PreviewResult = {
        url: previewUrl,
        html: null,
        expiresAt: resp?.expiresAt ?? null,
        source: "supabase",
      };
      setters.setLastPreviewState(result);
      setters.setRemoteFailure(null);
      await setLastPreview({
        url: result.url,
        source: result.source,
        createdAt: new Date().toISOString(),
        expiresAt: result.expiresAt,
      });
      if (setPreferredPreviewMode) await setPreferredPreviewMode("supabase");
      setters.setLastCreatedAt(Date.now());
      return { result, handledFailure: false };
    }

    throw new Error(resp?.error || "Preview konnte nicht erstellt werden");
  } catch (supErr: unknown) {
    setters.setRemoteFailure(
      describeRemotePreviewFailure({
        bearerJwt: userJwt,
        statusCode: getErrorStatusCode(supErr),
        error: supErr,
      }),
    );
    logger.warn("[usePreview] ⚠️ Supabase Preview fehlgeschlagen", supErr);
    return { result: null, handledFailure: true };
  }
};

export const createLocalFallbackPreview = async ({
  projectData,
  files,
  dependencies,
  setLastPreview,
  setters,
}: {
  projectData: ProjectData;
  files: Record<string, string>;
  dependencies: Record<string, string> | undefined;
  setLastPreview: (meta: LastPreviewMeta) => Promise<void>;
  setters: PreviewStateSetters;
}): Promise<PreviewResult | null> => {
  let html: string;
  try {
    html = buildSandpackHtml({
      title: projectData.name || "Preview",
      files,
      dependencies,
      allowUnsafeLocalEval: isExplicitUnsafeLocalPreviewEvalEnabled(),
      allowExternalCdnInUnsafeLocalEval: isExplicitUnsafeLocalPreviewEvalEnabled(),
    });
  } catch (e) {
    logger.error("[usePreview] buildSandpackHtml failed", { err: e });
    setters.setError("Lokaler Dev-Fallback konnte nicht erzeugt werden.");
    return null;
  }

  if (!html || typeof html !== "string") {
    setters.setError("Lokaler Dev-Fallback konnte nicht erzeugt werden.");
    return null;
  }

  const fallback: PreviewResult = {
    url: null,
    html,
    expiresAt: null,
    source: "local",
  };

  setters.setLastPreviewState(fallback);
  await setLastPreview({
    url: fallback.url,
    source: fallback.source,
    createdAt: new Date().toISOString(),
    expiresAt: fallback.expiresAt,
  });
  setters.setLastCreatedAt(Date.now());
  return fallback;
};
