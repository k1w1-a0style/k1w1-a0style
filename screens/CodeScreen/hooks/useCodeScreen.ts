// screens/CodeScreen/hooks/useCodeScreen.ts
// Thin orchestrator that composes focused sub-hooks.
import { useMemo } from "react";

import { useProject } from "../../../contexts/ProjectContext";
import type { UseCodeScreenReturn } from "./types";
import { useFileActions } from "./useFileActions";
import { useFileEditor } from "./useFileEditor";
import { useFileExplorer } from "./useFileExplorer";

export type { ViewMode, UseCodeScreenReturn } from "./types";

export const useCodeScreen = (): UseCodeScreenReturn => {
  const { projectData, isLoading } = useProject();

  const editor = useFileEditor();
  const explorer = useFileExplorer();

  const actionsDeps = useMemo(
    () => ({
      selectedFile: editor.selectedFile,
      setSelectedFile: editor.setSelectedFile,
      setEditingContent: editor.setEditingContent,
      setViewMode: editor.setViewMode,
      confirmLoseChanges: editor.confirmLoseChanges,

      selectionMode: explorer.selectionMode,
      toggleFileSelection: explorer.toggleFileSelection,
      currentFolderPath: explorer.currentFolderPath,
      setCurrentFolderPath: explorer.setCurrentFolderPath,
    }),
    [
      editor.confirmLoseChanges,
      editor.selectedFile,
      editor.setEditingContent,
      editor.setSelectedFile,
      editor.setViewMode,
      explorer.currentFolderPath,
      explorer.selectionMode,
      explorer.setCurrentFolderPath,
      explorer.toggleFileSelection,
    ],
  );

  const actions = useFileActions(actionsDeps);

  return {
    // Project
    projectData,
    isLoading,

    // Editor
    selectedFile: editor.selectedFile,
    setSelectedFile: editor.setSelectedFile,
    editingContent: editor.editingContent,
    setEditingContent: editor.setEditingContent,
    isDirty: editor.isDirty,
    viewMode: editor.viewMode,
    setViewMode: editor.setViewMode,
    syntaxErrors: editor.syntaxErrors,
    saveSelectedFile: editor.saveSelectedFile,
    handleSaveFile: editor.handleSaveFile,

    // Explorer
    currentFolderPath: explorer.currentFolderPath,
    setCurrentFolderPath: explorer.setCurrentFolderPath,
    currentFolderItems: explorer.currentFolderItems,
    allFolders: explorer.allFolders,
    selectionMode: explorer.selectionMode,
    setSelectionMode: explorer.setSelectionMode,
    selectedFiles: explorer.selectedFiles,
    setSelectedFiles: explorer.setSelectedFiles,
    toggleFileSelection: explorer.toggleFileSelection,
    selectAllFiles: explorer.selectAllFiles,
    deselectAllFiles: explorer.deselectAllFiles,
    exportSelectedFilesAsTxt: explorer.exportSelectedFilesAsTxt,

    // Actions
    showCreationDialog: actions.showCreationDialog,
    setShowCreationDialog: actions.setShowCreationDialog,
    showActionsModal: actions.showActionsModal,
    setShowActionsModal: actions.setShowActionsModal,
    actionTargetFile: actions.actionTargetFile,
    setActionTargetFile: actions.setActionTargetFile,
    handleItemPress: actions.handleItemPress,
    handleItemLongPress: actions.handleItemLongPress,
    handleCreateFile: actions.handleCreateFile,
    handleCreateFolder: actions.handleCreateFolder,
    handleRenameFile: actions.handleRenameFile,
    handleMoveFile: actions.handleMoveFile,
    handleDeleteFile: actions.handleDeleteFile,
    handleDuplicateFile: actions.handleDuplicateFile,
    handleCopy: actions.handleCopy,
  };
};
