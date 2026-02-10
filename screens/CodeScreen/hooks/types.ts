// screens/CodeScreen/hooks/types.ts
// Shared types for the CodeScreen hooks.
// The public interface is intentionally identical to the old monolith so that
// CodeScreen/index.tsx (and any other consumer) doesn't need to change.

import type { Dispatch, SetStateAction } from "react";

import type { TreeNode } from "../../../components/FileTree";
import type { useProject } from "../../../contexts/ProjectContext";
import type { ProjectFile } from "../../../contexts/types";
import type { SyntaxError as ValidationError } from "../../../utils/syntaxValidator";

export type ViewMode = "edit" | "preview";

export interface UseCodeScreenReturn {
  // Project
  projectData: ReturnType<typeof useProject>["projectData"];
  isLoading: ReturnType<typeof useProject>["isLoading"];

  // Editor
  selectedFile: ProjectFile | null;
  setSelectedFile: Dispatch<SetStateAction<ProjectFile | null>>;
  editingContent: string;
  setEditingContent: Dispatch<SetStateAction<string>>;
  isDirty: boolean;
  viewMode: ViewMode;
  setViewMode: Dispatch<SetStateAction<ViewMode>>;
  syntaxErrors: ValidationError[];

  saveSelectedFile: () => Promise<boolean>;
  handleSaveFile: () => void;
  handleCopy: (content: string) => void;

  // Explorer
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
}
