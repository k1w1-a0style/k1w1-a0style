// screens/CodeScreen/useCodeScreen.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Alert } from "react-native";

import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

import {
  buildFileTree,
  findFolderContent,
  type TreeNode,
} from "../../components/FileTree";
import { useProject } from "../../contexts/ProjectContext";
import type { ProjectFile } from "../../contexts/types";
import {
  validateCodeQuality,
  validateSyntax,
  type SyntaxError as ValidationError,
} from "../../utils/syntaxValidator";

export type ViewMode = "edit" | "preview";

export interface UseCodeScreenReturn {
  projectData: ReturnType<typeof useProject>["projectData"];
  isLoading: ReturnType<typeof useProject>["isLoading"];

  selectedFile: ProjectFile | null;
  setSelectedFile: Dispatch<SetStateAction<ProjectFile | null>>;
  editingContent: string;
  setEditingContent: Dispatch<SetStateAction<string>>;
  viewMode: ViewMode;
  setViewMode: Dispatch<SetStateAction<ViewMode>>;
  syntaxErrors: ValidationError[];

  currentFolderPath: string;
  setCurrentFolderPath: Dispatch<SetStateAction<string>>;
  showCreationDialog: boolean;
  setShowCreationDialog: Dispatch<SetStateAction<boolean>>;

  selectionMode: boolean;
  setSelectionMode: Dispatch<SetStateAction<boolean>>;
  selectedFiles: Set<string>;
  setSelectedFiles: Dispatch<SetStateAction<Set<string>>>;

  showActionsModal: boolean;
  setShowActionsModal: Dispatch<SetStateAction<boolean>>;
  actionTargetFile: ProjectFile | null;
  setActionTargetFile: Dispatch<SetStateAction<ProjectFile | null>>;

  currentFolderItems: TreeNode[];
  allFolders: string[];

  toggleFileSelection: (filePath: string) => void;
  selectAllFiles: () => void;
  deselectAllFiles: () => void;
  exportSelectedFilesAsTxt: () => Promise<void>;

  handleItemPress: (node: TreeNode) => void;
  handleItemLongPress: (node: TreeNode) => void;

  handleCreateFile: (name: string) => void;
  handleCreateFolder: (name: string) => void;

  handleRenameFile: (newName: string) => void;
  handleMoveFile: (targetFolder: string) => void;
  handleDeleteFile: () => void;
  handleDuplicateFile: () => void;

  handleSaveFile: () => void;
  handleCopy: (content: string) => void;
}

export const useCodeScreen = (): UseCodeScreenReturn => {
  const {
    projectData,
    isLoading,
    updateProjectFiles,
    createFile,
    deleteFile,
    renameFile,
  } = useProject();

  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [editingContent, setEditingContent] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [syntaxErrors, setSyntaxErrors] = useState<ValidationError[]>([]);

  const [currentFolderPath, setCurrentFolderPath] = useState<string>("");
  const [showCreationDialog, setShowCreationDialog] = useState(false);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const [showActionsModal, setShowActionsModal] = useState(false);
  const [actionTargetFile, setActionTargetFile] = useState<ProjectFile | null>(
    null,
  );

  const fileTree = useMemo(() => {
    if (projectData?.files) return buildFileTree(projectData.files);
    return [];
  }, [projectData?.files]);

  const currentFolderItems = useMemo(() => {
    return findFolderContent(fileTree, currentFolderPath);
  }, [fileTree, currentFolderPath]);

  const allFolders = useMemo(() => {
    const folders: string[] = [];
    const extractFolders = (nodes: TreeNode[]): void => {
      nodes.forEach((node) => {
        if (node.type === "folder") {
          folders.push(node.path);
          if (node.children) {
            extractFolders(node.children);
          }
        }
      });
    };
    extractFolders(fileTree);
    return folders;
  }, [fileTree]);

  useEffect(() => {
    if (!selectedFile || viewMode !== "edit" || !editingContent.trim()) {
      setSyntaxErrors([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      try {
        const errors = [
          ...validateSyntax(editingContent, selectedFile.path),
          ...validateCodeQuality(editingContent, selectedFile.path),
        ];
        setSyntaxErrors(errors);
      } catch {
        setSyntaxErrors([]);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [editingContent, selectedFile, viewMode]);

  const toggleFileSelection = useCallback((filePath: string) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(filePath)) {
        newSet.delete(filePath);
      } else {
        newSet.add(filePath);
      }
      return newSet;
    });
  }, []);

  const selectAllFiles = useCallback(() => {
    const allFiles =
      projectData?.files
        .filter((f) => !f.path.includes("node_modules"))
        .map((f) => f.path) || [];
    setSelectedFiles(new Set(allFiles));
  }, [projectData?.files]);

  const deselectAllFiles = useCallback(() => {
    setSelectedFiles(new Set());
  }, []);

  const exportSelectedFilesAsTxt = useCallback(async () => {
    if (selectedFiles.size === 0) {
      Alert.alert(
        "Keine Dateien",
        "Bitte wählen Sie mindestens eine Datei zum Export aus",
      );
      return;
    }

    try {
      const files =
        projectData?.files.filter((f) => selectedFiles.has(f.path)) || [];

      let content = `# ${projectData?.name || "Project"} - Code Export\n`;
      content += `# Erstellt am: ${new Date().toLocaleString("de-DE")}\n`;
      content += `# Anzahl Dateien: ${files.length}\n`;
      content += `\n${"=".repeat(80)}\n\n`;

      files.forEach((file, index) => {
        const fileContent =
          typeof file.content === "string"
            ? file.content
            : JSON.stringify(file.content, null, 2);

        content += `\n### DATEI ${index + 1}: ${file.path}\n`;
        content += `${"─".repeat(80)}\n\n`;
        content += fileContent;
        content += `\n\n${"=".repeat(80)}\n`;
      });

      const fileName = `${projectData?.name || "export"}_${Date.now()}.txt`;

      const baseDir =
        (FileSystem as any).documentDirectory ??
        (FileSystem as any).cacheDirectory ??
        "";
      const fileUri = `${baseDir}${fileName}`;
      const encoding = (FileSystem as any).EncodingType?.UTF8 ?? "utf8";

      await (FileSystem as any).writeAsStringAsync(fileUri, content, {
        encoding,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/plain",
          dialogTitle: "Code exportieren",
        });
      } else {
        Alert.alert("✅ Exportiert", `Datei gespeichert als: ${fileName}`);
      }

      setSelectionMode(false);
      setSelectedFiles(new Set());
    } catch (error) {
      Alert.alert(
        "Fehler",
        "Export fehlgeschlagen: " + (error as Error).message,
      );
    }
  }, [projectData?.files, projectData?.name, selectedFiles]);

  const handleItemPress = useCallback(
    (node: TreeNode) => {
      if (selectionMode && node.type === "file" && node.file) {
        toggleFileSelection(node.file.path);
        return;
      }

      if (node.type === "folder") {
        setCurrentFolderPath(node.path);
      } else if (node.file) {
        const contentString =
          typeof node.file.content === "string"
            ? node.file.content
            : JSON.stringify(node.file.content, null, 2);

        setSelectedFile(node.file);
        setEditingContent(contentString);
        setViewMode("preview");
        setSyntaxErrors([]);
      }
    },
    [selectionMode, toggleFileSelection],
  );

  const handleItemLongPress = useCallback(
    (node: TreeNode) => {
      if (selectionMode) return;

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
                        ) || [];
                      filesToDelete.forEach((f) => deleteFile(f.path));
                    },
                  },
                ],
              );
            },
          },
          { text: "Abbrechen", style: "cancel" },
        ]);
      } else if (node.file) {
        setActionTargetFile(node.file);
        setShowActionsModal(true);
      }
    },
    [selectionMode, projectData?.files, deleteFile],
  );

  const handleRenameFile = useCallback(
    (newName: string) => {
      if (!actionTargetFile) return;

      const oldPath = actionTargetFile.path;
      const pathParts = oldPath.split("/");
      pathParts[pathParts.length - 1] = newName;
      const newPath = pathParts.join("/");

      renameFile(oldPath, newPath);

      if (selectedFile?.path === oldPath) {
        setSelectedFile({ ...actionTargetFile, path: newPath });
      }
    },
    [actionTargetFile, renameFile, selectedFile],
  );

  const handleMoveFile = useCallback(
    (targetFolder: string) => {
      if (!actionTargetFile) return;

      const fileName = actionTargetFile.path.split("/").pop() || "";
      const newPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;

      renameFile(actionTargetFile.path, newPath);

      if (selectedFile?.path === actionTargetFile.path) {
        setSelectedFile({ ...actionTargetFile, path: newPath });
      }
    },
    [actionTargetFile, renameFile, selectedFile],
  );

  const handleDeleteFile = useCallback(() => {
    if (!actionTargetFile) return;

    deleteFile(actionTargetFile.path);

    if (selectedFile?.path === actionTargetFile.path) {
      setSelectedFile(null);
      setEditingContent("");
    }
  }, [actionTargetFile, deleteFile, selectedFile]);

  const handleDuplicateFile = useCallback(() => {
    if (!actionTargetFile) return;

    const ext = actionTargetFile.path.split(".").pop() || "";
    const baseName = actionTargetFile.path.replace(`.${ext}`, "");
    const newPath = `${baseName}_copy.${ext}`;

    createFile(newPath, actionTargetFile.content);
    Alert.alert("✅ Dupliziert", `Neue Datei erstellt: ${newPath}`);
  }, [actionTargetFile, createFile]);

  const handleCreateFile = useCallback(
    (name: string) => {
      const fullPath = currentFolderPath
        ? `${currentFolderPath}/${name}`
        : name;
      const ext = name.includes(".") ? "" : ".tsx";
      const finalPath = fullPath + ext;

      createFile(finalPath, `// ${finalPath}\n`);

      const newFile: ProjectFile = {
        path: finalPath,
        content: `// ${finalPath}\n`,
      };
      setSelectedFile(newFile);
      setEditingContent(`// ${finalPath}\n`);
      setViewMode("edit");
    },
    [createFile, currentFolderPath],
  );

  const handleCreateFolder = useCallback(
    (name: string) => {
      const fullPath = currentFolderPath
        ? `${currentFolderPath}/${name}`
        : name;
      createFile(`${fullPath}/.gitkeep`, "");
      Alert.alert("✅ Erfolg", `Ordner "${name}" erstellt`);
    },
    [createFile, currentFolderPath],
  );

  const handleSaveFile = useCallback(() => {
    if (!selectedFile) return;

    try {
      const errors = validateSyntax(editingContent, selectedFile.path);
      const criticalErrors = errors.filter((e) => e.severity === "error");

      if (criticalErrors.length > 0) {
        const errorList = criticalErrors
          .map((e) => `• ${e.message}`)
          .join("\n");
        Alert.alert(
          "Syntax-Fehler",
          `Die folgenden Fehler wurden gefunden:\n\n${errorList}\n\nTrotzdem speichern?`,
          [
            { text: "Abbrechen", style: "cancel" },
            {
              text: "Trotzdem speichern",
              style: "destructive",
              onPress: () => {
                updateProjectFiles([
                  { path: selectedFile.path, content: editingContent },
                ]);
                setSelectedFile((prev) =>
                  prev ? { ...prev, content: editingContent } : null,
                );
                Alert.alert("✅ Gespeichert", selectedFile.path);
              },
            },
          ],
        );
        return;
      }

      updateProjectFiles([
        { path: selectedFile.path, content: editingContent },
      ]);
      setSelectedFile((prev) =>
        prev ? { ...prev, content: editingContent } : null,
      );
      Alert.alert("✅ Gespeichert", selectedFile.path);
    } catch {
      Alert.alert("Fehler", "Datei konnte nicht gespeichert werden.");
    }
  }, [editingContent, selectedFile, updateProjectFiles]);

  const handleCopy = useCallback((content: string) => {
    Clipboard.setStringAsync(content);
    Alert.alert("✅ Kopiert", "Code in Zwischenablage kopiert");
  }, []);

  return {
    projectData,
    isLoading,
    selectedFile,
    setSelectedFile,
    editingContent,
    setEditingContent,
    viewMode,
    setViewMode,
    syntaxErrors,
    currentFolderPath,
    setCurrentFolderPath,
    showCreationDialog,
    setShowCreationDialog,
    selectionMode,
    setSelectionMode,
    selectedFiles,
    setSelectedFiles,
    showActionsModal,
    setShowActionsModal,
    actionTargetFile,
    setActionTargetFile,
    currentFolderItems,
    allFolders,
    toggleFileSelection,
    selectAllFiles,
    deselectAllFiles,
    exportSelectedFilesAsTxt,
    handleItemPress,
    handleItemLongPress,
    handleCreateFile,
    handleCreateFolder,
    handleRenameFile,
    handleMoveFile,
    handleDeleteFile,
    handleDuplicateFile,
    handleSaveFile,
    handleCopy,
  };
};
