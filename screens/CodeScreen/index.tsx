// screens/CodeScreen/index.tsx
import React from "react";
import { Alert, KeyboardAvoidingView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CreationDialog } from "../../components/CreationDialog";
import { FileActionsModal } from "../../components/FileActionsModal";
import { EditorBody } from "./components/EditorBody";
import { EditorHeaderContent } from "./components/EditorHeaderContent";
import { ExplorerHeader } from "./components/ExplorerHeader";
import { FileExplorer } from "./components/FileExplorer";
import { ImageViewer } from "./components/ImageViewer";
import { LoadingView } from "./components/LoadingView";
import { SyntaxErrorBar } from "./components/SyntaxErrorBar";
import { styles } from "./styles";
import { useCodeScreen } from "./useCodeScreen";

const CodeScreen: React.FC = () => {
  const {
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
  } = useCodeScreen();

  if (isLoading && !projectData) {
    return <LoadingView />;
  }

  // ==================== IMAGE VIEWER ====================
  if (
    selectedFile &&
    /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(selectedFile.path)
  ) {
    return (
      <ImageViewer
        filePath={selectedFile.path}
        content={editingContent}
        onBack={() => setSelectedFile(null)}
        onCopy={() => handleCopy(editingContent)}
      />
    );
  }

  // ==================== CODE EDITOR (FULLSCREEN) ====================
  if (selectedFile) {
    const isDirty = selectedFile.content !== editingContent;
    const isCodeFile =
      /\.(tsx?|jsx?|json|md|css|scss|html|xml|yaml|yml)$/i.test(
        selectedFile.path,
      );

    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <KeyboardAvoidingView style={styles.container} behavior="height">
          <View style={styles.editorHeader}>
            <EditorHeaderContent
              fileName={selectedFile.path.split("/").pop() || ""}
              isDirty={isDirty}
              isCodeFile={isCodeFile}
              viewMode={viewMode}
              onBack={() => {
                if (isDirty) {
                  Alert.alert(
                    "Ungespeicherte Änderungen",
                    "Möchten Sie die Änderungen speichern?",
                    [
                      {
                        text: "Verwerfen",
                        style: "destructive",
                        onPress: () => setSelectedFile(null),
                      },
                      {
                        text: "Speichern",
                        onPress: () => {
                          handleSaveFile();
                          setSelectedFile(null);
                        },
                      },
                      { text: "Abbrechen", style: "cancel" },
                    ],
                  );
                } else {
                  setSelectedFile(null);
                }
              }}
              onToggleViewMode={() =>
                setViewMode((prev) => (prev === "edit" ? "preview" : "edit"))
              }
              onCopy={() => handleCopy(editingContent)}
              onSave={handleSaveFile}
            />
          </View>

          <SyntaxErrorBar
            visible={syntaxErrors.length > 0 && viewMode === "edit"}
            errors={syntaxErrors}
          />

          <EditorBody
            viewMode={viewMode}
            content={editingContent}
            syntaxErrors={syntaxErrors}
            onChangeText={setEditingContent}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ==================== FILE EXPLORER ====================
  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <ExplorerHeader
        projectName={projectData?.name || "Kein Projekt"}
        selectionMode={selectionMode}
        selectedCount={selectedFiles.size}
        onExitSelection={() => {
          setSelectionMode(false);
          setSelectedFiles(new Set());
        }}
        onSelectAll={selectAllFiles}
        onDeselectAll={deselectAllFiles}
        onExport={exportSelectedFilesAsTxt}
        onEnterSelection={() => setSelectionMode(true)}
        onOpenCreationDialog={() => setShowCreationDialog(true)}
      />

      <FileExplorer
        currentFolderPath={currentFolderPath}
        currentFolderItems={currentFolderItems}
        selectionMode={selectionMode}
        selectedFiles={selectedFiles}
        onNavigate={setCurrentFolderPath}
        onItemPress={handleItemPress}
        onItemLongPress={handleItemLongPress}
        onOpenCreationDialog={() => setShowCreationDialog(true)}
      />

      <CreationDialog
        visible={showCreationDialog}
        currentPath={currentFolderPath}
        onClose={() => setShowCreationDialog(false)}
        onCreateFile={handleCreateFile}
        onCreateFolder={handleCreateFolder}
      />

      <FileActionsModal
        visible={showActionsModal}
        fileName={actionTargetFile?.path.split("/").pop() || ""}
        filePath={actionTargetFile?.path || ""}
        onClose={() => {
          setShowActionsModal(false);
          setActionTargetFile(null);
        }}
        onRename={handleRenameFile}
        onMove={handleMoveFile}
        onDelete={handleDeleteFile}
        onDuplicate={handleDuplicateFile}
        folders={allFolders}
      />
    </SafeAreaView>
  );
};

export default CodeScreen;
