// screens/CodeScreen.tsx – Optimierter Code Explorer (ohne Split-Screen)
import React, { useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { theme } from '../theme';
import { useProject } from '../contexts/ProjectContext';
import type { ProjectFile } from '../contexts/types';
import { SyntaxHighlighter } from '../components/SyntaxHighlighter';
import { type TreeNode } from '../components/FileTree';
import { useFileTree } from '../hooks/useFileTree';
import { Breadcrumb } from '../components/Breadcrumb';
import FileItem from '../components/FileItem';
import { CreationDialog } from '../components/CreationDialog';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// File extension utilities
const getFileExtension = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return ext;
};

const isCodeFile = (path: string): boolean => {
  return /\.(tsx?|jsx?|js|json|md|css|html?|xml|yaml|yml|sh|py|rb|go|rs|swift|kt|java|c|cpp|h)$/i.test(path);
};

const isImageFile = (path: string): boolean => {
  return /\.(png|jpg|jpeg|gif|webp|svg|ico|bmp)$/i.test(path);
};

const getLanguageFromExtension = (ext: string): string => {
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    html: 'html',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    swift: 'swift',
    kt: 'kotlin',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    sh: 'bash',
  };
  return map[ext] || 'text';
};

// Header component for editor view
const EditorHeader = memo(({
  file,
  viewMode,
  onBack,
  onToggleView,
  onSave,
  onDelete,
  hasChanges,
}: {
  file: ProjectFile;
  viewMode: 'edit' | 'preview';
  onBack: () => void;
  onToggleView: () => void;
  onSave: () => void;
  onDelete: () => void;
  hasChanges: boolean;
}) => {
  const ext = getFileExtension(file.path);
  const isCode = isCodeFile(file.path);
  
  return (
    <View style={styles.editorHeader}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Ionicons name="arrow-back" size={22} color={theme.palette.text.primary} />
      </TouchableOpacity>
      
      <View style={styles.editorHeaderInfo}>
        <Text style={styles.editorFileName} numberOfLines={1}>
          {file.path.split('/').pop()}
        </Text>
        <Text style={styles.editorFilePath} numberOfLines={1}>
          {file.path}
        </Text>
      </View>

      <View style={styles.editorActions}>
        {isCode && (
          <TouchableOpacity style={styles.actionBtn} onPress={onToggleView}>
            <Ionicons
              name={viewMode === 'edit' ? 'eye-outline' : 'create-outline'}
              size={20}
              color={theme.palette.text.secondary}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={[styles.actionBtn, hasChanges && styles.actionBtnHighlight]} 
          onPress={onSave}
        >
          <Ionicons
            name="save-outline"
            size={20}
            color={hasChanges ? theme.palette.primary : theme.palette.text.secondary}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={onDelete}>
          <Ionicons name="trash-outline" size={20} color={theme.palette.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

EditorHeader.displayName = 'EditorHeader';

// Explorer Header
const ExplorerHeader = memo(({
  currentPath,
  fileCount,
  onCreateNew,
}: {
  currentPath: string;
  fileCount: number;
  onCreateNew: () => void;
}) => (
  <View style={styles.explorerHeader}>
    <View style={styles.explorerHeaderLeft}>
      <Ionicons name="folder-open-outline" size={24} color={theme.palette.primary} />
      <View style={styles.explorerHeaderInfo}>
        <Text style={styles.explorerTitle}>Code Explorer</Text>
        <Text style={styles.explorerSubtitle}>
          {fileCount} {fileCount === 1 ? 'Datei' : 'Dateien'}
        </Text>
      </View>
    </View>

    <TouchableOpacity style={styles.newFileBtn} onPress={onCreateNew}>
      <Ionicons name="add" size={20} color="#fff" />
      <Text style={styles.newFileBtnText}>Neu</Text>
    </TouchableOpacity>
  </View>
));

ExplorerHeader.displayName = 'ExplorerHeader';

// Empty State
const EmptyState = memo(() => (
  <View style={styles.emptyState}>
    <Ionicons name="document-outline" size={48} color={theme.palette.text.muted} />
    <Text style={styles.emptyStateTitle}>Ordner ist leer</Text>
    <Text style={styles.emptyStateSubtitle}>
      Erstelle eine neue Datei oder navigiere zurück
    </Text>
  </View>
));

EmptyState.displayName = 'EmptyState';

const CodeScreen: React.FC = () => {
  const {
    projectData,
    isLoading,
    updateProjectFiles,
    createFile,
    deleteFile,
  } = useProject();

  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [showCreationDialog, setShowCreationDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('preview');

  const files = projectData?.files ?? [];
  const { currentFolderItems, currentFolderPath, setCurrentFolderPath } = useFileTree(files);

  const hasChanges = editingContent !== originalContent;

  const handleItemPress = useCallback((node: TreeNode) => {
    if (node.type === 'folder') {
      setCurrentFolderPath(node.path);
      return;
    }

    if (!node.file) return;

    const content = typeof node.file.content === 'string'
      ? node.file.content
      : JSON.stringify(node.file.content, null, 2);

    setSelectedFile(node.file);
    setEditingContent(content);
    setOriginalContent(content);
    setViewMode(isCodeFile(node.file.path) ? 'preview' : 'edit');
  }, [setCurrentFolderPath]);

  const handleBack = useCallback(() => {
    if (hasChanges) {
      Alert.alert(
        'Änderungen verwerfen?',
        'Du hast ungespeicherte Änderungen.',
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Verwerfen', style: 'destructive', onPress: () => {
            setSelectedFile(null);
            setEditingContent('');
            setOriginalContent('');
          }},
        ]
      );
    } else {
      setSelectedFile(null);
      setEditingContent('');
      setOriginalContent('');
    }
  }, [hasChanges]);

  const handleSaveFile = useCallback(async () => {
    if (!selectedFile) return;

    const updated: ProjectFile = {
      ...selectedFile,
      content: editingContent,
    };

    const nextFiles = files.map((f) => f.path === updated.path ? updated : f);

    await updateProjectFiles(nextFiles);
    setSelectedFile(updated);
    setOriginalContent(editingContent);
    Alert.alert('✅ Gespeichert', 'Datei wurde gespeichert.');
  }, [selectedFile, editingContent, files, updateProjectFiles]);

  const handleDeleteFile = useCallback(() => {
    if (!selectedFile) return;

    Alert.alert(
      'Datei löschen?',
      `"${selectedFile.path}" wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            await deleteFile(selectedFile.path);
            setSelectedFile(null);
            setEditingContent('');
            setOriginalContent('');
          },
        },
      ]
    );
  }, [selectedFile, deleteFile]);

  const handleToggleView = useCallback(() => {
    setViewMode((prev) => prev === 'edit' ? 'preview' : 'edit');
  }, []);

  const handleDeleteItem = useCallback((node: TreeNode) => {
    if (!node.file) return;
    
    Alert.alert(
      'Datei löschen?',
      `"${node.file.path}" wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => deleteFile(node.file!.path),
        },
      ]
    );
  }, [deleteFile]);

  const renderFileItem = useCallback(({ item }: { item: TreeNode }) => (
    <FileItem
      node={item}
      onPress={() => handleItemPress(item)}
      onLongPress={() => handleDeleteItem(item)}
    />
  ), [handleItemPress, handleDeleteItem]);

  const keyExtractor = useCallback((item: TreeNode) => item.id, []);

  // Editor View
  if (selectedFile) {
    const isCode = isCodeFile(selectedFile.path);
    const isImage = isImageFile(selectedFile.path);
    const ext = getFileExtension(selectedFile.path);

    return (
      <SafeAreaView style={styles.root} edges={['bottom', 'left', 'right']}>
        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <EditorHeader
            file={selectedFile}
            viewMode={viewMode}
            onBack={handleBack}
            onToggleView={handleToggleView}
            onSave={handleSaveFile}
            onDelete={handleDeleteFile}
            hasChanges={hasChanges}
          />

          <Animated.View 
            entering={FadeIn.duration(300)} 
            style={styles.editorContainer}
          >
            {isImage ? (
              <View style={styles.imagePreviewContainer}>
                <Ionicons name="image-outline" size={64} color={theme.palette.text.muted} />
                <Text style={styles.imagePreviewText}>Bild-Vorschau nicht verfügbar</Text>
                <Text style={styles.imagePreviewPath}>{selectedFile.path}</Text>
              </View>
            ) : isCode && viewMode === 'preview' ? (
              <SyntaxHighlighter code={editingContent} />
            ) : (
              <TextInput
                style={styles.editorInput}
                multiline
                value={editingContent}
                onChangeText={setEditingContent}
                autoCapitalize="none"
                autoCorrect={false}
                textAlignVertical="top"
                placeholder="Dateiinhalt hier eingeben..."
                placeholderTextColor={theme.palette.text.muted}
              />
            )}
          </Animated.View>

          {hasChanges && (
            <View style={styles.unsavedBanner}>
              <Ionicons name="alert-circle" size={16} color={theme.palette.warning} />
              <Text style={styles.unsavedText}>Ungespeicherte Änderungen</Text>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Explorer View
  return (
    <SafeAreaView style={styles.root} edges={['bottom', 'left', 'right']}>
      <ExplorerHeader
        currentPath={currentFolderPath}
        fileCount={files.length}
        onCreateNew={() => setShowCreationDialog(true)}
      />

      <Breadcrumb
        currentPath={currentFolderPath}
        onNavigate={setCurrentFolderPath}
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.palette.primary} />
          <Text style={styles.loadingText}>Dateien werden geladen...</Text>
        </View>
      ) : (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.listContainer}>
          <FlatList
            data={currentFolderItems}
            keyExtractor={keyExtractor}
            renderItem={renderFileItem}
            contentContainerStyle={currentFolderItems.length === 0 ? { flex: 1 } : styles.listContent}
            ListEmptyComponent={<EmptyState />}
            showsVerticalScrollIndicator={false}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={5}
          />
        </Animated.View>
      )}

      <CreationDialog
        visible={showCreationDialog}
        currentPath={currentFolderPath}
        onClose={() => setShowCreationDialog(false)}
        onCreateFile={(name) => createFile(name, '')}
        onCreateFolder={(p) => createFile(p.endsWith('/') ? p : `${p}/`, '')}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },

  // Explorer Header
  explorerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: theme.palette.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  explorerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  explorerHeaderInfo: {
    gap: 2,
  },
  explorerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.palette.text.primary,
  },
  explorerSubtitle: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  newFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.palette.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  newFileBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // List
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: theme.palette.text.secondary,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    textAlign: 'center',
  },

  // Editor Header
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.palette.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    gap: 10,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: theme.palette.background,
  },
  editorHeaderInfo: {
    flex: 1,
    minWidth: 0,
  },
  editorFileName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  editorFilePath: {
    fontSize: 11,
    color: theme.palette.text.secondary,
  },
  editorActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: theme.palette.background,
  },
  actionBtnHighlight: {
    backgroundColor: theme.palette.primarySoft,
  },

  // Editor Container
  editorContainer: {
    flex: 1,
    backgroundColor: theme.palette.code.background,
  },
  editorInput: {
    flex: 1,
    padding: 16,
    fontSize: 14,
    lineHeight: 22,
    color: theme.palette.text.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlignVertical: 'top',
  },

  // Image Preview
  imagePreviewContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  imagePreviewText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.palette.text.secondary,
  },
  imagePreviewPath: {
    fontSize: 12,
    color: theme.palette.text.muted,
  },

  // Unsaved Banner
  unsavedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    backgroundColor: theme.palette.warningSoft,
    borderTopWidth: 1,
    borderTopColor: theme.palette.warning,
  },
  unsavedText: {
    fontSize: 13,
    color: theme.palette.warning,
    fontWeight: '500',
  },
});

export default CodeScreen;
