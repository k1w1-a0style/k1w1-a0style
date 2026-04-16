import { useCallback } from "react";
import { Alert } from "react-native";

import { logger } from "../../lib/logger";
import type { LastPreviewMeta, PreferredPreviewMode, ProjectFile, TemplateId } from "../../shared/types/project";
import { validateFileContent, validateFilePath } from "../../lib/validators";
import { materializeProjectFiles } from "../../lib/projectMaterializer";
import { applyProjectFileUpdates, mergeProjectFiles } from "../../project/domain/projectFileMutations";
import { normalizeProjectSlug, removeProjectFilesByPaths } from "../projectContextHelpers";
import { resolveLinkedBranchForRepoSelection } from "../projectContextStateHelpers";
import type { ProjectFileCommandsInput } from "./projectContext.contracts";
import type { FileCommandResult } from "./projectContext.contracts";

const fileCommandResult = (
  status: FileCommandResult["status"],
  reason?: string,
): FileCommandResult => ({
  status,
  changed: status === "success",
  reason,
});

export function useProjectFileCommands({ updateProject }: ProjectFileCommandsInput) {
  const sanitizeProjectFiles = useCallback((files: ProjectFile[]): ProjectFile[] => {
    const sanitizedFiles: ProjectFile[] = [];
    for (const candidate of files) {
      const pathValidation = validateFilePath(candidate.path);
      if (!pathValidation.valid) {
        throw new Error(`Ungültiger Dateipfad (${candidate.path}): ${pathValidation.errors.join(", ")}`);
      }
      const normalizedPath = pathValidation.normalized || candidate.path;
      const contentValidation = validateFileContent(candidate.content);
      if (!contentValidation.valid) {
        throw new Error(
          `Ungültiger Dateiinhalt (${normalizedPath}): ${contentValidation.error || "Datei ist zu groß"}`,
        );
      }
      sanitizedFiles.push({ path: normalizedPath, content: candidate.content });
    }
    return sanitizedFiles;
  }, []);

  const updateProjectFiles = useCallback(
    async (files: ProjectFile[], newName?: string) => {
      const sanitizedUpdates = sanitizeProjectFiles(files);

      await updateProject((prev) => {
        const mergedFiles = mergeProjectFiles(prev.files, sanitizedUpdates);
        logger.info(
          `📝 Dateien aktualisiert: ${sanitizedUpdates.length} geändert, ${mergedFiles.length} gesamt`,
        );
        return applyProjectFileUpdates(prev, sanitizedUpdates, newName);
      });
    },
    [sanitizeProjectFiles, updateProject],
  );

  const replaceProjectFiles = useCallback(
    async (files: ProjectFile[], newName?: string) => {
      const sanitizedFiles = sanitizeProjectFiles(files);

      await updateProject((prev) => {
        logger.info(
          `🧱 Dateien vollständig ersetzt: ${sanitizedFiles.length} gesamt`,
        );
        return {
          ...prev,
          files: sanitizedFiles,
          name: newName || prev.name,
        };
      });
    },
    [sanitizeProjectFiles, updateProject],
  );

  const createFile = useCallback(
    async (path: string, content: string) => {
      const pathValidation = validateFilePath(path);
      if (!pathValidation.valid) {
        Alert.alert("Ungültiger Dateipfad", pathValidation.errors.join("\n"));
        return fileCommandResult("rejected", "invalid_path");
      }

      const contentValidation = validateFileContent(content);
      if (!contentValidation.valid) {
        Alert.alert(
          "Ungültiger Dateiinhalt",
          contentValidation.error || "Datei ist zu groß",
        );
        return fileCommandResult("rejected", "invalid_content");
      }

      const validPath = pathValidation.normalized || path;

      let changed = false;
      await updateProject((prev) => {
        if (prev.files.some((f) => f.path === validPath)) {
          Alert.alert(
            "Fehler",
            "Eine Datei mit diesem Pfad existiert bereits.",
          );
          return prev;
        }
        changed = true;
        return {
          ...prev,
          files: [...prev.files, { path: validPath, content }],
        };
      });
      return changed
        ? fileCommandResult("success")
        : fileCommandResult("noop", "path_exists");
    },
    [updateProject],
  );

  const deleteFile = useCallback(
    async (path: string) => {
      const normalizedPath = String(path ?? "").trim();
      if (!normalizedPath) return fileCommandResult("rejected", "empty_path");
      let changed = false;
      await updateProject((prev) => ({
        ...prev,
        files: (() => {
          const next = removeProjectFilesByPaths(prev.files, [normalizedPath]);
          changed = next.length !== prev.files.length;
          return next;
        })(),
      }));
      return changed
        ? fileCommandResult("success")
        : fileCommandResult("noop", "not_found");
    },
    [updateProject],
  );

  const deleteFiles = useCallback(
    async (paths: string[]) => {
      const normalizedPaths = paths
        .map((path) => String(path ?? "").trim())
        .filter((path) => path.length > 0);
      if (!normalizedPaths.length) return fileCommandResult("rejected", "empty_paths");

      let changed = false;
      await updateProject((prev) => ({
        ...prev,
        files: (() => {
          const next = removeProjectFilesByPaths(prev.files, normalizedPaths);
          changed = next.length !== prev.files.length;
          return next;
        })(),
      }));
      return changed
        ? fileCommandResult("success")
        : fileCommandResult("noop", "not_found");
    },
    [updateProject],
  );

  const renameFile = useCallback(
    async (oldPath: string, newPath: string) => {
      const normalizedOldPath = String(oldPath ?? "").trim();
      if (!normalizedOldPath) {
        Alert.alert("Ungültiger Dateipfad", "Der aktuelle Dateipfad ist leer.");
        return fileCommandResult("rejected", "empty_old_path");
      }
      const pathValidation = validateFilePath(newPath);
      if (!pathValidation.valid) {
        Alert.alert("Ungültiger Dateipfad", pathValidation.errors.join("\n"));
        return fileCommandResult("rejected", "invalid_path");
      }

      const validNewPath = pathValidation.normalized || newPath;

      let changed = false;
      await updateProject((prev) => {
        if (prev.files.some((f) => f.path === validNewPath)) {
          Alert.alert(
            "Fehler",
            "Eine Datei mit dem neuen Pfad existiert bereits.",
          );
          return prev;
        }
        if (!prev.files.some((f) => f.path === normalizedOldPath)) {
          Alert.alert(
            "Fehler",
            "Die Quelldatei wurde nicht gefunden.",
          );
          return prev;
        }
        changed = true;
        return {
          ...prev,
          files: prev.files.map((f) =>
            f.path === normalizedOldPath ? { ...f, path: validNewPath } : f,
          ),
        };
      });
      return changed
        ? fileCommandResult("success")
        : fileCommandResult("noop", "missing_source_or_conflict");
    },
    [updateProject],
  );

  const setProjectName = useCallback(async (newName: string) => {
    await updateProject((prev) => {
      const slug = normalizeProjectSlug(newName);
      return {
        ...prev,
        name: newName,
        slug,
        files: materializeProjectFiles(prev.files, {
          name: newName,
          slug,
          packageName: prev.packageName,
        }),
      };
    });
  }, [updateProject]);

  const setLastPreview = useCallback(async (preview: LastPreviewMeta | null) => {
    await updateProject((prev) => ({ ...prev, lastPreview: preview ?? null }));
  }, [updateProject]);

  const setPackageName = useCallback(async (packageName: string) => {
    await updateProject((prev) => ({
      ...prev,
      packageName,
      files: materializeProjectFiles(prev.files, {
        name: prev.name,
        slug: prev.slug ?? prev.name,
        packageName,
      }),
    }));
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
    replaceProjectFiles,
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
