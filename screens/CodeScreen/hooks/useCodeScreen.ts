// screens/CodeScreen/hooks/useCodeScreen.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Alert } from "react-native";

import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

import {
  buildFileTree,
  findFolderContent,
  type TreeNode,
} from "../../../components/FileTree";
import { useProject } from "../../../contexts/ProjectContext";
import type { ProjectFile } from "../../../contexts/types";
import {
  validateCodeQuality,
  validateSyntax,
  type SyntaxError as ValidationError,
} from "../../../utils/syntaxValidator";

export type ViewMode = "edit" | "preview";

export interface UseCodeScreenReturn {
  projectData: ReturnType<typeof useProject>["projectData"];
  isLoading: ReturnType<typeof useProject>["isLoading"];

  selectedFile: ProjectFile | null;
  setSelectedFile: Dispatch<SetStateAction<ProjectFile | null>>;
  editingContent: string;
  setEditingContent: Dispatch<SetStateAction<string>>;
  /** True when the selected file has unsaved changes. */
  isDirty: boolean;
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

const toContentString = (file: ProjectFile): string => {
  return typeof file.content === "string"
    ? file.content
    : JSON.stringify(file.content, null, 2);
};

const countLines = (s: string): number => {
  // Fast-ish line counting
  let n = 1;
  for (let i = 0; i < s.length; i += 1) {
    if (s.charCodeAt(i) === 10) n += 1; // \n
  }
  return n;
};

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

  const lastSelectedPathRef = useRef<string | null>(null);

  const selectedOriginalContent = useMemo(() => {
    return selectedFile ? toContentString(selectedFile) : "";
  }, [selectedFile]);

  const isDirty = useMemo(() => {
    if (!selectedFile) return false;
    // If user opens a file and we set editingContent from file content,
    // this simple compare works (and we also update selectedFile content on save).
    return editingContent !== selectedOriginalContent;
	}, [editingContent, selectedFile, selectedOriginalContent]);

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

  // Live validation — gets expensive on huge files.
  useEffect(() => {
    if (!selectedFile || viewMode !== "edit") {
      setSyntaxErrors([]);
      return;
    }
    if (!editingContent.trim()) {
      setSyntaxErrors([]);
      return;
    }

    const len = editingContent.length;
    const lines = countLines(editingContent);

    // Heuristics: keep editor smooth. No UI changes, just reduces background work.
    const huge = len > 600_000;
    const large = len > 200_000 || lines > 5_000;

    if (huge) {
      // Skip live validation entirely.
      setSyntaxErrors([]);
      return;
    }

    const debounceMs = large ? 1500 : 500;
    const includeQuality = !large;

    const timeoutId = setTimeout(() => {
      try {
        const errors = [
          ...validateSyntax(editingContent, selectedFile.path),
          ...(includeQuality
            ? validateCodeQuality(editingContent, selectedFile.path)
            : []),
        ];
        setSyntaxErrors(errors);
      } catch {
        setSyntaxErrors([]);
      }
    }, debounceMs);

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
        const fileContent = toContentString(file);

        content += `\n### DATEI ${index + 1}: ${file.path}\n`;
        content += `${"─".repeat(80)}\n\n`;
        content += fileContent;
        content += `\n\n${"=".repeat(80)}\n`;
      });

      const fileName = `${projectData?.name || "export"}_${Date.now()}.txt`;

      // NOTE: expo-file-system typings in this repo don't expose these fields,
      // and eslint(import/namespace) validates exported members strictly.
      // Use a local alias typed as any to keep TS + ESLint happy.
      const FS: any = FileSystem;

      const baseDir: string | undefined = FS.documentDirectory ?? FS.cacheDirectory;
      if (!baseDir) {
        throw new Error("Kein schreibbares Verzeichnis (document/cache) gefunden");
      }

      // Ensure exactly one trailing slash.
      const normalized = String(baseDir).endsWith("/") ? String(baseDir) : `${String(baseDir)}/`;
      const fileUri = `${normalized}${fileName}`;

      // UTF-8 is default; avoid EncodingType to keep typings compatible.
      await FS.writeAsStringAsync(fileUri, content);

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

  const handleSaveFile = useCallback(() => {
    if (!selectedFile) return;

    try {
      const errors = validateSyntax(editingContent, selectedFile.path);
      const criticalErrors = errors.filter((e) => e.severity === "error");

      const doSave = (): void => {
        updateProjectFiles([
          { path: selectedFile.path, content: editingContent },
        ]);
        setSelectedFile((prev) =>
          prev ? { ...prev, content: editingContent } : null,
        );
        Alert.alert("✅ Gespeichert", selectedFile.path);
      };

      if (criticalErrors.length > 0) {
        const errorList = criticalErrors
          .map((e) => `• ${e.message}`)
          .join("\n");
        Alert.alert(
          "Syntax-Fehler",
          `Die folgenden Fehler wurden gefunden:\n\n${errorList}\n\nTrotzdem speichern?`,
          [
            { text: "Abbrechen", style: "cancel" },
            { text: "Trotzdem speichern", style: "destructive", onPress: doSave },
          ],
        );
        return;
      }

      doSave();
    } catch {
      Alert.alert("Fehler", "Datei konnte nicht gespeichert werden.");
    }
  }, [editingContent, selectedFile, updateProjectFiles]);

  const confirmLoseChanges = useCallback(
    (next: () => void) => {
      if (!isDirty) {
        next();
        return;
      }
      Alert.alert(
        "Ungespeicherte Änderungen",
        "Du hast Änderungen, die noch nicht gespeichert sind. Was soll passieren?",
        [
          { text: "Abbrechen", style: "cancel" },
          {
            text: "Verwerfen",
            style: "destructive",
            onPress: next,
          },
          {
            text: "Speichern",
            onPress: () => {
              handleSaveFile();
              next();
            },
          },
        ],
      );
    },
    [handleSaveFile, isDirty],
  );

  const handleItemPress = useCallback(
    (node: TreeNode) => {
      if (selectionMode && node.type === "file" && node.file) {
        toggleFileSelection(node.file.path);
        return;
      }

      // Guard: prevent accidental loss when switching items while editing.
      const proceed = (): void => {
        if (node.type === "folder") {
          setCurrentFolderPath(node.path);
          return;
        }

        if (node.file) {
          const nextPath = node.file.path;
          // Avoid useless re-select (reduces state churn & potential WebView race)
          if (lastSelectedPathRef.current === nextPath && selectedFile) {
            return;
          }
          lastSelectedPathRef.current = nextPath;

          const contentString = toContentString(node.file);

          setSelectedFile(node.file);
          setEditingContent(contentString);
          setViewMode("preview");
          setSyntaxErrors([]);
        }
      };

      confirmLoseChanges(proceed);
    },
    [
      confirmLoseChanges,
      selectionMode,
      selectedFile,
      toggleFileSelection,
    ],
  );

  const handleItemLongPress = useCallback(
    (node: TreeNode) => {
      if (selectionMode) return;

      // Guard: don't open action menu while dirty without a decision.
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

    const files = projectData?.files ?? [];
    const existing = new Set(files.map((f) => f.path));

    const parts = actionTargetFile.path.split("/");
    const fileName = parts.pop() ?? actionTargetFile.path;
    const dir = parts.join("/");

    const dotIdx = fileName.lastIndexOf(".");
    const stem = dotIdx > 0 ? fileName.slice(0, dotIdx) : fileName;
    const ext = dotIdx > 0 ? fileName.slice(dotIdx) : "";

    // Choose a non-colliding name: _copy, _copy2, _copy3, ...
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
      const fullPath = currentFolderPath
        ? `${currentFolderPath}/${name}`
        : name;
      const needsExt =
        !name.includes(".") &&
        !name.startsWith(".") &&
        name !== "Dockerfile" &&
        name !== "Makefile";
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

  const handleCopy = useCallback((content: string) => {
    // Clipboard can fail on some Android setups; keep UX smooth.
    Clipboard.setStringAsync(content)
      .then(() => {
        Alert.alert("✅ Kopiert", "Code in Zwischenablage kopiert");
      })
      .catch(() => {
        Alert.alert("Fehler", "Kopieren fehlgeschlagen.");
      });
  }, []);

  return {
    projectData,
    isLoading,
    selectedFile,
    setSelectedFile,
    editingContent,
    setEditingContent,
	  isDirty,
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
