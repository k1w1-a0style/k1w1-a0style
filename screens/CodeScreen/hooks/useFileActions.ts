// screens/CodeScreen/hooks/useFileActions.ts
// REFACTORED: types/constants → fileActionTypes.ts

// screens/CodeScreen/hooks/useFileActions.ts
// Handles: file CRUD (create, rename, move, delete, duplicate),
//          item press / long-press logic, clipboard copy.
import { useCallback, useRef, useState } from "react";
import { Alert } from "react-native";

import * as Clipboard from "expo-clipboard";

import type { TreeNode } from "../../../components/FileTree";
import { useProject } from "../../../contexts/ProjectContext";


import type { ViewMode } from "./useFileEditor";
import { toContentString } from "./useFileEditor";

// Files that are commonly extensionless and should stay that way.
import type { ProjectFile } from "../../../shared/types/project";
import type { FileCommandResult } from "../../../contexts/projectContext/projectContext.contracts";

import { EXTENSIONLESS_ALLOWLIST, validatePathOrAlert } from "./fileActionTypes";
import type { FileActionsDeps, UseFileActionsReturn } from "./fileActionTypes";
export type { UseFileActionsReturn, FileActionsDeps } from "./fileActionTypes";

export const useFileActions = (deps: FileActionsDeps): UseFileActionsReturn => {
  const { projectData, createFile, deleteFile, deleteFiles, renameFile } = useProject();

  const {
    selectedFile,
    setSelectedFile,
    setEditingContent,
    setViewMode,
    confirmLoseChanges,
    selectionMode,
    toggleFileSelection,
    currentFolderPath,
    setCurrentFolderPath,
  } = deps;

  const [showCreationDialog, setShowCreationDialog] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [actionTargetFile, setActionTargetFile] = useState<ProjectFile | null>(
    null,
  );

  const actionInFlightRef = useRef(false);
  const selectedFileRef = useRef(selectedFile);
  selectedFileRef.current = selectedFile;

  const isSuccessResult = useCallback(
    (result: FileCommandResult | null | undefined): result is FileCommandResult =>
      result?.status === "success" && result.changed === true,
    [],
  );

  const handleItemPress = useCallback(
    (node: TreeNode) => {
      if (selectionMode && node.type === "file" && node.file) {
        toggleFileSelection(node.file.path);
        return;
      }

      const proceed = (): void => {
        if (node.type === "folder") {
          setCurrentFolderPath(node.path);
          return;
        }

        if (node.file) {
          const contentString = toContentString(node.file);
          setSelectedFile({ ...node.file });
          setEditingContent(contentString);
          // Switching to preview ensures validation is cleared by the editor hook.
          setViewMode("preview");
        }
      };

      confirmLoseChanges(proceed);
    },
    [
      confirmLoseChanges,
      selectionMode,
      setCurrentFolderPath,
      setEditingContent,
      setSelectedFile,
      setViewMode,
      toggleFileSelection,
    ],
  );

  const handleItemLongPress = useCallback(
    (node: TreeNode) => {
      if (selectionMode) return;

      const proceed = (): void => {
        if (node.type === "folder") {
          Alert.alert(node.name, "Ordner-Aktion wählen:", [
            {
              text: "Löschen",
              style: "destructive",
              onPress: () => {
                Alert.alert(
                  "Ordner löschen",
                  `Ordner "${node.name}" und alle Inhalte wirklich löschen?`,
                  [
                    { text: "Abbrechen", style: "cancel" },
                    {
                      text: "Löschen",
                      style: "destructive",
                      onPress: () => {
                        const folderPrefix = node.path + "/";
                        const filesToDelete =
                          projectData?.files.filter((f) =>
                            f.path.startsWith(folderPrefix),
                          ) ?? [];

                        const paths = filesToDelete.map((f) => f.path);
                        void (async () => {
                          let deleteResult: FileCommandResult;
                          if (deleteFiles) {
                            deleteResult = await deleteFiles(paths);
                          } else {
                            // Fallback should preserve semantics for contexts without deleteFiles support.
                            const results = await Promise.all(paths.map((path) => deleteFile(path)));
                            const hasError = results.some((result) => result.status === "error");
                            const hasRejected = results.some((result) => result.status === "rejected");
                            const changed = results.some((result) => result.status === "success");
                            const status: FileCommandResult["status"] = hasError
                              ? "error"
                              : hasRejected
                                ? "rejected"
                                : changed
                                  ? "success"
                                  : "noop";
                            deleteResult = {
                              status,
                              changed,
                              reason:
                                status === "error"
                                  ? "fallback_error"
                                  : status === "rejected"
                                    ? "fallback_rejected"
                                    : changed
                                      ? undefined
                                      : "not_found",
                            };
                          }

                          // Clean up editor state only when the folder deletion actually changed files.
                          if (
                            isSuccessResult(deleteResult) &&
                            selectedFileRef.current?.path.startsWith(folderPrefix)
                          ) {
                            setSelectedFile(null);
                            setEditingContent("");
                          }
                        })();
                      },
                    },
                  ],
                );
              },
            },
            { text: "Abbrechen", style: "cancel" },
          ]);
          return;
        }

        if (node.file) {
          setActionTargetFile(node.file);
          setShowActionsModal(true);
        }
      };

      confirmLoseChanges(proceed);
    },
    [confirmLoseChanges, deleteFile, deleteFiles, isSuccessResult, projectData?.files, selectionMode, setEditingContent, setSelectedFile],
  );

  const handleRenameFile = useCallback(
    async (newName: string) => {
      if (!actionTargetFile) return;

      const oldPath = actionTargetFile.path;
      const parts = oldPath.split("/");
      parts[parts.length - 1] = newName;
      const newPath = parts.join("/");

      if (!validatePathOrAlert(newPath)) return;

      const files = projectData?.files ?? [];
      if (files.some((f) => f.path === newPath)) {
        Alert.alert(
          "Datei existiert bereits",
          `Es gibt bereits eine Datei mit dem Pfad:\n${newPath}`,
        );
        return;
      }

      const result = await renameFile(oldPath, newPath);
      if (result.status !== "success") return;

      if (selectedFile?.path === oldPath) {
        setSelectedFile({ ...actionTargetFile, path: newPath });
      }
    },
    [actionTargetFile, projectData?.files, renameFile, selectedFile, setSelectedFile],
  );

  const handleMoveFile = useCallback(
    async (targetFolder: string) => {
      if (!actionTargetFile) return;

      const fileName = actionTargetFile.path.split("/").pop() ?? "";
      const newPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;

      if (!validatePathOrAlert(newPath)) return;

      const files = projectData?.files ?? [];
      if (files.some((f) => f.path === newPath)) {
        Alert.alert(
          "Datei existiert bereits",
          `Es gibt bereits eine Datei mit dem Pfad:\n${newPath}`,
        );
        return;
      }

      const oldPath = actionTargetFile.path;
      const result = await renameFile(oldPath, newPath);
      if (result.status !== "success") return;

      if (selectedFile?.path === oldPath) {
        setSelectedFile({ ...actionTargetFile, path: newPath });
      }
    },
    [actionTargetFile, projectData?.files, renameFile, selectedFile, setSelectedFile],
  );

  const handleDeleteFile = useCallback(async () => {
    const targetPath = actionTargetFile?.path;
    if (!targetPath) {
      Alert.alert("Fehler", "Keine Datei zum Löschen ausgewählt.");
      return;
    }

    const result = await deleteFile(targetPath);
    if (result.status !== "success") return;

    if (selectedFileRef.current?.path === targetPath) {
      setSelectedFile(null);
      setEditingContent("");
    }
  }, [actionTargetFile?.path, deleteFile, setEditingContent, setSelectedFile]);

  const handleDuplicateFile = useCallback(async () => {
    if (!actionTargetFile) return;

    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;

    try {
      const files = projectData?.files ?? [];
      const existing = new Set(files.map((f) => f.path));

      const parts = actionTargetFile.path.split("/");
      const fileName = parts.pop() ?? actionTargetFile.path;
      const dir = parts.join("/");

      const dot = fileName.lastIndexOf(".");
      const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
      const ext = dot > 0 ? fileName.slice(dot) : "";

      let candidate = `${stem}_copy${ext}`;
      if (dir) candidate = `${dir}/${candidate}`;

      if (existing.has(candidate)) {
        for (let i = 2; i < 1000; i++) {
          let next = `${stem}_copy${i}${ext}`;
          if (dir) next = `${dir}/${next}`;
          if (!existing.has(next)) {
            candidate = next;
            break;
          }
        }
      }

      if (!validatePathOrAlert(candidate)) return;

      const result = await createFile(candidate, toContentString(actionTargetFile));
      if (result.status !== "success") {
        Alert.alert("Fehler", "Duplizieren konnte nicht angewendet werden.");
        return;
      }
      Alert.alert("✅ Dupliziert", `Neue Datei erstellt: ${candidate}`);
    } catch {
      Alert.alert("Fehler", "Duplizieren fehlgeschlagen.");
    } finally {
      actionInFlightRef.current = false;
    }
  }, [actionTargetFile, createFile, projectData?.files]);

  const handleCreateFile = useCallback(
    async (name: string) => {
      const baseName = name.trim();
      if (!baseName) return;

      const fullPath = currentFolderPath
        ? `${currentFolderPath}/${baseName}`
        : baseName;

      const needsExt =
        !baseName.includes(".") &&
        !baseName.startsWith(".") &&
        !EXTENSIONLESS_ALLOWLIST.has(baseName);
      const finalPath = needsExt ? `${fullPath}.tsx` : fullPath;

      if (!validatePathOrAlert(finalPath)) return;

      const files = projectData?.files ?? [];
      if (files.some((f) => f.path === finalPath)) {
        Alert.alert(
          "Datei existiert bereits",
          `Es gibt bereits eine Datei mit dem Pfad:\n${finalPath}`,
        );
        return;
      }

      const initialContent = `// ${finalPath}\n`;
      const result = await createFile(finalPath, initialContent);
      if (result.status !== "success") return;

      // Optimistic selection is safe now (path validated + no collision).
      const newFile: ProjectFile = { path: finalPath, content: initialContent };
      setSelectedFile(newFile);
      setEditingContent(initialContent);
      setViewMode("edit");
    },
    [createFile, currentFolderPath, projectData?.files, setEditingContent, setSelectedFile, setViewMode],
  );

  const handleCreateFolder = useCallback(
    async (name: string) => {
      const folderName = name.trim();
      if (!folderName) return;

      if (actionInFlightRef.current) return;
      actionInFlightRef.current = true;

      try {
        const fullPath = currentFolderPath
          ? `${currentFolderPath}/${folderName}`
          : folderName;

        const gitkeepPath = `${fullPath}/.gitkeep`;
        if (!validatePathOrAlert(gitkeepPath)) return;

        const existing = new Set((projectData?.files ?? []).map((f) => f.path));
        if (existing.has(gitkeepPath)) {
          Alert.alert("Fehler", `Ordner "${folderName}" existiert bereits.`);
          return;
        }

        const result = await createFile(gitkeepPath, "");
        if (result.status !== "success") {
          Alert.alert("Fehler", "Ordner konnte nicht erstellt werden.");
          return;
        }
        Alert.alert("✅ Erfolg", `Ordner "${folderName}" erstellt`);
      } catch {
        Alert.alert("Fehler", "Ordner konnte nicht erstellt werden.");
      } finally {
        actionInFlightRef.current = false;
      }
    },
    [createFile, currentFolderPath, projectData?.files],
  );

  const handleCopy = useCallback((content: string) => {
    Clipboard.setStringAsync(content)
      .then(() => {
        Alert.alert("✅ Kopiert", "Code in Zwischenablage kopiert");
      })
      .catch(() => {
        Alert.alert("Fehler", "Kopieren fehlgeschlagen.");
      });
  }, []);

  return {
    showCreationDialog,
    setShowCreationDialog,
    showActionsModal,
    setShowActionsModal,
    actionTargetFile,
    setActionTargetFile,
    handleItemPress,
    handleItemLongPress,
    handleCreateFile,
    handleCreateFolder,
    handleRenameFile,
    handleMoveFile,
    handleDeleteFile,
    handleDuplicateFile,
    handleCopy,
  };
};
