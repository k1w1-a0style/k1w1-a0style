// screens/CodeScreen/hooks/fileActionTypes.ts
// Extracted from useFileActions.ts: types and constants.

// screens/CodeScreen/hooks/useFileActions.ts
// Handles: file CRUD (create, rename, move, delete, duplicate),
//          item press / long-press logic, clipboard copy.
import { useCallback, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Alert } from "react-native";

import * as Clipboard from "expo-clipboard";

import type { TreeNode } from "../../../components/FileTree";
import { useProject } from "../../../contexts/ProjectContext";

import { validateFilePath } from "../../../lib/validators";

import type { ViewMode } from "./useFileEditor";
import { toContentString } from "./useFileEditor";

// Files that are commonly extensionless and should stay that way.
import type { ProjectFile } from "../../../shared/types/project";

export const EXTENSIONLESS_ALLOWLIST = new Set<string>([
  "Dockerfile",
  "Makefile",
  "README",
  "LICENSE",
  "CHANGELOG",
]);

export const validatePathOrAlert = (path: string): boolean => {
  const res = validateFilePath(path);
  if (res.valid) return true;
  Alert.alert("Ungültiger Dateipfad", res.errors.join("\n"));
  return false;
};

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

