// screens/CodeScreen/hooks/useFileActions.ts
// Handles: file CRUD (create, rename, move, delete, duplicate),
//          item press / long-press logic, clipboard copy.
import { useCallback, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Alert } from "react-native";

import * as Clipboard from "expo-clipboard";

import type { TreeNode } from "../../../components/FileTree";
import { useProject } from "../../../contexts/ProjectContext";
import type { ProjectFile } from "../../../contexts/types";

import type { ViewMode } from "./useFileEditor";
import { toContentString } from "./useFileEditor";

// Files that are commonly extensionless and should stay that way.
const EXTENSIONLESS_ALLOWLIST = new Set<string>([
  "Dockerfile",
  "Makefile",
  "README",
  "LICENSE",
  "CHANGELOG",
]);

export interface UseFileActionsReturn {
  showCreationDialog: boolean;
  setShowCreationDialog: Dispatch<SetStateAction<boolean>>;
  showActionsModal: boolean;
  setShowActionsModal: Dispatch<SetStateAction<boolean>>;
  actionTargetFile: ProjectFile | null;
  setActionTargetFile: Dispatch<SetStateAction<ProjectFile | null>>;

  handleItemPress: (node: TreeNode) => void;
  handleItemLongPress: (node: TreeNode) => void;

  handleCreateFile: (name: string) => void;
  handleCreateFolder: (name: string) => void;
  handleRenameFile: (newName: string) => void;
  handleMoveFile: (targetFolder: string) => void;
  handleDeleteFile: () => void;
  handleDuplicateFile: () => void;
  handleCopy: (content: string) => void;
}

// Deps from sibling hooks that the actions hook needs.
export interface FileActionsDeps {
  selectedFile: ProjectFile | null;
  setSelectedFile: Dispatch<SetStateAction<ProjectFile | null>>;
  setEditingContent: Dispatch<SetStateAction<string>>;
  setViewMode: Dispatch<SetStateAction<ViewMode>>;
  confirmLoseChanges: (next: () => void) => void;

  selectionMode: boolean;
  toggleFileSelection: (path: string) => void;

  currentFolderPath: string;
  setCurrentFolderPath: Dispatch<SetStateAction<string>>;
}

export const useFileActions = (deps: FileActionsDeps): UseFileActionsReturn => {
  const { projectData, createFile, deleteFile, renameFile } = useProject();

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

  const lastSelectedPathRef = useRef<string | null>(null);

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
          const nextPath = node.file.path;
          if (lastSelectedPathRef.current === nextPath && selectedFile) return;
          lastSelectedPathRef.current = nextPath;

          const contentString = toContentString(node.file);
          setSelectedFile(node.file);
          setEditingContent(contentString);
          // Switching to preview ensures validation is cleared by the editor hook.
          setViewMode("preview");
        }
      };

      confirmLoseChanges(proceed);
    },
    [
      confirmLoseChanges,
      selectedFile,
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
                        const filesToDelete =
                          projectData?.files.filter((f) =>
                            f.path.startsWith(node.path + "/"),
                          ) ?? [];
                        filesToDelete.forEach((f) => deleteFile(f.path));
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
    [confirmLoseChanges, deleteFile, projectData?.files, selectionMode],
  );

  const handleRenameFile = useCallback(
    (newName: string) => {
      if (!actionTargetFile) return;

      const oldPath = actionTargetFile.path;
      const parts = oldPath.split("/");
      parts[parts.length - 1] = newName;
      const newPath = parts.join("/");

      renameFile(oldPath, newPath);

      if (selectedFile?.path === oldPath) {
        setSelectedFile({ ...actionTargetFile, path: newPath });
      }
    },
    [actionTargetFile, renameFile, selectedFile, setSelectedFile],
  );

  const handleMoveFile = useCallback(
    (targetFolder: string) => {
      if (!actionTargetFile) return;

      const fileName = actionTargetFile.path.split("/").pop() ?? "";
      const newPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;

      renameFile(actionTargetFile.path, newPath);

      if (selectedFile?.path === actionTargetFile.path) {
        setSelectedFile({ ...actionTargetFile, path: newPath });
      }
    },
    [actionTargetFile, renameFile, selectedFile, setSelectedFile],
  );

  const handleDeleteFile = useCallback(() => {
    if (!actionTargetFile) return;

    deleteFile(actionTargetFile.path);

    if (selectedFile?.path === actionTargetFile.path) {
      setSelectedFile(null);
      setEditingContent("");
    }
  }, [actionTargetFile, deleteFile, selectedFile, setEditingContent, setSelectedFile]);

  const handleDuplicateFile = useCallback(() => {
    if (!actionTargetFile) return;

    const files = projectData?.files ?? [];
    const existing = new Set(files.map((f) => f.path));

    const parts = actionTargetFile.path.split("/");
    const fileName = parts.pop() ?? actionTargetFile.path;
    const dir = parts.join("/");

    const dotIdx = fileName.lastIndexOf(".");
    const stem = dotIdx > 0 ? fileName.slice(0, dotIdx) : fileName;
    const ext = dotIdx > 0 ? fileName.slice(dotIdx) : "";

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

    createFile(candidate, actionTargetFile.content);
    Alert.alert("✅ Dupliziert", `Neue Datei erstellt: ${candidate}`);
  }, [actionTargetFile, createFile, projectData?.files]);

  const handleCreateFile = useCallback(
    (name: string) => {
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

      createFile(finalPath, `// ${finalPath}\n`);

      const newFile: ProjectFile = {
        path: finalPath,
        content: `// ${finalPath}\n`,
      };
      setSelectedFile(newFile);
      setEditingContent(`// ${finalPath}\n`);
      setViewMode("edit");
    },
    [createFile, currentFolderPath, setEditingContent, setSelectedFile, setViewMode],
  );

  const handleCreateFolder = useCallback(
    (name: string) => {
      const folderName = name.trim();
      if (!folderName) return;
      const fullPath = currentFolderPath
        ? `${currentFolderPath}/${folderName}`
        : folderName;

      createFile(`${fullPath}/.gitkeep`, "");
      Alert.alert("✅ Erfolg", `Ordner "${folderName}" erstellt`);
    },
    [createFile, currentFolderPath],
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
