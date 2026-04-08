import { useCallback } from "react";
import { Alert } from "react-native";

import { logger } from "../../lib/logger";
import type { LastPreviewMeta, PreferredPreviewMode, ProjectFile, TemplateId } from "../../shared/types/project";
import { validateFileContent, validateFilePath } from "../../lib/validators";
import { applyProjectFileUpdates, mergeProjectFiles } from "../../project/domain/projectFileMutations";
import { removeProjectFilesByPaths } from "../projectContextHelpers";
import { resolveLinkedBranchForRepoSelection } from "../projectContextStateHelpers";
import type { ProjectFileCommandsInput } from "./projectContext.contracts";

export function useProjectFileCommands({ updateProject }: ProjectFileCommandsInput) {
  const updateProjectFiles = useCallback(
    async (files: ProjectFile[], newName?: string) => {
      await updateProject((prev) => {
        const mergedFiles = mergeProjectFiles(prev.files, files);
        logger.info(
          `📝 Dateien aktualisiert: ${files.length} geändert, ${mergedFiles.length} gesamt`,
        );
        return applyProjectFileUpdates(prev, files, newName);
      });
    },
    [updateProject],
  );

  const createFile = useCallback(
    async (path: string, content: string) => {
      const pathValidation = validateFilePath(path);
      if (!pathValidation.valid) {
        Alert.alert("Ungültiger Dateipfad", pathValidation.errors.join("\n"));
        return;
      }

      const contentValidation = validateFileContent(content);
      if (!contentValidation.valid) {
        Alert.alert(
          "Ungültiger Dateiinhalt",
          contentValidation.error || "Datei ist zu groß",
        );
        return;
      }

      const validPath = pathValidation.normalized || path;

      await updateProject((prev) => {
        if (prev.files.some((f) => f.path === validPath)) {
          Alert.alert(
            "Fehler",
            "Eine Datei mit diesem Pfad existiert bereits.",
          );
          return prev;
        }
        return {
          ...prev,
          files: [...prev.files, { path: validPath, content }],
        };
      });
    },
    [updateProject],
  );

  const deleteFile = useCallback(
    async (path: string) => {
      await updateProject((prev) => ({
        ...prev,
        files: removeProjectFilesByPaths(prev.files, [path]),
      }));
    },
    [updateProject],
  );

  const deleteFiles = useCallback(
    async (paths: string[]) => {
      if (!paths.some((path) => typeof path === "string" && path.length > 0)) return;

      await updateProject((prev) => ({
        ...prev,
        files: removeProjectFilesByPaths(prev.files, paths),
      }));
    },
    [updateProject],
  );

  const renameFile = useCallback(
    async (oldPath: string, newPath: string) => {
      const pathValidation = validateFilePath(newPath);
      if (!pathValidation.valid) {
        Alert.alert("Ungültiger Dateipfad", pathValidation.errors.join("\n"));
        return;
      }

      const validNewPath = pathValidation.normalized || newPath;

      await updateProject((prev) => {
        if (prev.files.some((f) => f.path === validNewPath)) {
          Alert.alert(
            "Fehler",
            "Eine Datei mit dem neuen Pfad existiert bereits.",
          );
          return prev;
        }
        return {
          ...prev,
          files: prev.files.map((f) =>
            f.path === oldPath ? { ...f, path: validNewPath } : f,
          ),
        };
      });
    },
    [updateProject],
  );

  const setProjectName = useCallback(async (newName: string) => {
    await updateProject((prev) => ({ ...prev, name: newName }));
  }, [updateProject]);

  const setLastPreview = useCallback(async (preview: LastPreviewMeta | null) => {
    await updateProject((prev) => ({ ...prev, lastPreview: preview ?? null }));
  }, [updateProject]);

  const setPackageName = useCallback(async (packageName: string) => {
    await updateProject((prev) => ({ ...prev, packageName }));
  }, [updateProject]);

  const setLinkedRepo = useCallback(
    async (repo: string | null, branch?: string | null) => {
      await updateProject((prev) => ({
        ...prev,
        linkedRepo: repo,
        linkedBranch: resolveLinkedBranchForRepoSelection({
          previousRepo: prev.linkedRepo,
          nextRepo: repo,
          previousBranch: prev.linkedBranch,
          nextBranch: branch,
        }),
      }));
      logger.info(
        `🔗 Projekt verknüpft mit: ${repo ?? "–"} (Branch: ${branch ?? "–"})`,
      );
    },
    [updateProject],
  );

  const setTemplateId = useCallback(async (templateId: TemplateId) => {
    if (!templateId) return;
    await updateProject((prev) => ({ ...prev, templateId }));
    logger.info(`🧩 Template gespeichert: ${templateId}`);
  }, [updateProject]);

  const setAdvancedTemplatePickerEnabled = useCallback(async (enabled: boolean) => {
    await updateProject((prev) => ({
      ...prev,
      advancedTemplatePickerEnabled: enabled,
    }));
  }, [updateProject]);

  const setPreferredBuildProfile = useCallback(
    async (profile: "development" | "preview" | "production") => {
      await updateProject((prev) => ({
        ...prev,
        preferredBuildProfile: profile,
      }));
      logger.info(`⚙️ Preferred Build-Profile gespeichert: ${profile}`);
    },
    [updateProject],
  );

  const setPreferredPreviewMode = useCallback(
    async (mode: PreferredPreviewMode) => {
      await updateProject((prev) => ({
        ...prev,
        preferredPreviewMode: mode,
      }));
      logger.info(`🖥️ Preferred Preview-Mode gespeichert: ${mode}`);
    },
    [updateProject],
  );

  return {
    updateProjectFiles,
    createFile,
    deleteFile,
    deleteFiles,
    renameFile,
    setProjectName,
    setLastPreview,
    setPackageName,
    setLinkedRepo,
    setTemplateId,
    setAdvancedTemplatePickerEnabled,
    setPreferredBuildProfile,
    setPreferredPreviewMode,
  };
}
