// screens/CodeScreen/hooks/useFileExplorer.ts
// Handles: folder navigation, file tree derivation, selection mode, and export.
import { useCallback, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Alert } from "react-native";

import {
  cacheDirectory,
  documentDirectory,
  writeAsStringAsync,
} from "expo-file-system";
import * as Sharing from "expo-sharing";

import {
  buildFileTree,
  findFolderContent,
  type TreeNode,
} from "../../../components/FileTree";
import { useProject } from "../../../contexts/ProjectContext";
import type { ProjectFile } from "../../../contexts/types";

const toContentString = (file: ProjectFile): string =>
  typeof file.content === "string"
    ? file.content
    : JSON.stringify(file.content, null, 2);

export interface UseFileExplorerReturn {
  currentFolderItems: TreeNode[];
  allFolders: string[];

  currentFolderPath: string;
  setCurrentFolderPath: Dispatch<SetStateAction<string>>;

  selectionMode: boolean;
  setSelectionMode: Dispatch<SetStateAction<boolean>>;
  selectedFiles: Set<string>;
  setSelectedFiles: Dispatch<SetStateAction<Set<string>>>;

  toggleFileSelection: (filePath: string) => void;
  selectAllFiles: () => void;
  deselectAllFiles: () => void;
  exportSelectedFilesAsTxt: () => Promise<void>;
}

export const useFileExplorer = (): UseFileExplorerReturn => {
  const { projectData } = useProject();

  const [currentFolderPath, setCurrentFolderPath] = useState<string>("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const fileTree = useMemo(() => {
    if (projectData?.files) return buildFileTree(projectData.files);
    return [];
  }, [projectData?.files]);

  const currentFolderItems = useMemo(
    () => findFolderContent(fileTree, currentFolderPath),
    [fileTree, currentFolderPath],
  );

  const allFolders = useMemo(() => {
    const folders: string[] = [];
    const walk = (nodes: TreeNode[]): void => {
      nodes.forEach((n) => {
        if (n.type === "folder") {
          folders.push(n.path);
          if (n.children) walk(n.children);
        }
      });
    };
    walk(fileTree);
    return folders;
  }, [fileTree]);

  const toggleFileSelection = useCallback((filePath: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) next.delete(filePath);
      else next.add(filePath);
      return next;
    });
  }, []);

  const selectAllFiles = useCallback(() => {
    const all =
      projectData?.files
        .filter((f) => !f.path.includes("node_modules"))
        .map((f) => f.path) ?? [];
    setSelectedFiles(new Set(all));
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
        projectData?.files.filter((f) => selectedFiles.has(f.path)) ?? [];

      let content = `# ${projectData?.name ?? "Project"} - Code Export\n`;
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

      const fileName = `${projectData?.name ?? "export"}_${Date.now()}.txt`;

      const baseDir = documentDirectory ?? cacheDirectory;
      if (!baseDir) {
        throw new Error("Kein schreibbares Verzeichnis (document/cache) gefunden");
      }

      const normalized = baseDir.endsWith("/") ? baseDir : `${baseDir}/`;
      const fileUri = `${normalized}${fileName}`;

      await writeAsStringAsync(fileUri, content);

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

  return {
    currentFolderItems,
    allFolders,
    currentFolderPath,
    setCurrentFolderPath,
    selectionMode,
    setSelectionMode,
    selectedFiles,
    setSelectedFiles,
    toggleFileSelection,
    selectAllFiles,
    deselectAllFiles,
    exportSelectedFilesAsTxt,
  };
};
