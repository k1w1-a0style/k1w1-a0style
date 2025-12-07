import React, { useState, useCallback } from 'react';
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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../theme';
import { useProject } from '../contexts/ProjectContext';
import type { ProjectFile } from '../contexts/types';
import { SyntaxHighlighter } from '../components/SyntaxHighlighter';
import { type TreeNode } from '../components/FileTree';
import { useFileTree } from '../hooks/useFileTree';
import { Breadcrumb } from '../components/Breadcrumb';
import FileItem from '../components/FileItem';
import { CreationDialog } from '../components/CreationDialog';

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
  const [showCreationDialog, setShowCreationDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('preview');

  const files = projectData?.files ?? [];
  const { currentFolderItems, currentFolderPath, setCurrentFolderPath } =
    useFileTree(files);

  const isCodeFile = (file: ProjectFile | null) =>
    !!file?.path.match(/\.(tsx?|jsx?|js|json|md|css|html?)$/i);

  const isImageFile = (file: ProjectFile | null) =>
    !!file?.path.match(/\.(png|jpg|jpeg|gif|webp)$/i);

  const handleItemPress = useCallback(
    (node: TreeNode) => {
      if (node.type === 'folder') {
        setCurrentFolderPath(node.path);
        return;
      }

      if (!node.file) return;

      setSelectedFile(node.file);

      const content =
        typeof node.file.content === 'string'
          ? node.file.content
          : JSON.stringify(node.file.content, null, 2);

      setEditingContent(content);
      setViewMode(isCodeFile(node.file) ? 'preview' : 'edit');
    },
    [setCurrentFolderPath],
  );

  const handleSaveFile = useCallback(async () => {
    if (!selectedFile) return;

    const updated: ProjectFile = {
      ...selectedFile,
      content: editingContent,
    };

    const nextFiles: ProjectFile[] = files.map((file: ProjectFile) =>
      file.path === updated.path ? updated : file,
    );

    await updateProjectFiles(nextFiles);
    setSelectedFile(updated);
    Alert.alert('Gespeichert', 'Datei wurde gespeichert.');
  }, [selectedFile, editingContent, files, updateProjectFiles]);

  // EDITOR / PREVIEW
  if (selectedFile) {
    const isCode = isCodeFile(selectedFile);
    const isImg = isImageFile(selectedFile);

    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {selectedFile.path}
            </Text>
            <Text style={styles.headerSubtitle}>
              {isCode
                ? 'Code-Datei'
                : isImg
                ? 'Bild'
                : 'Projektdatei'}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => {
                setSelectedFile(null);
                setEditingContent('');
              }}
              style={styles.backButton}
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color={theme.palette.text.primary}
              />
            </TouchableOpacity>

            {isCode && (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() =>
                  setViewMode((prev) =>
                    prev === 'edit' ? 'preview' : 'edit',
                  )
                }
              >
                <Ionicons
                  name={
                    viewMode === 'edit' ? 'eye-outline' : 'create-outline'
                  }
                  size={20}
                  color={theme.palette.text.primary}
                />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleSaveFile}
            >
              <Ionicons
                name="save-outline"
                size={20}
                color={theme.palette.primary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconButton}
              onPress={() =>
                Alert.alert('Datei löschen', 'Wirklich löschen?', [
                  { text: 'Abbrechen', style: 'cancel' },
                  {
                    text: 'Löschen',
                    style: 'destructive',
                    onPress: async () => {
                      await deleteFile(selectedFile.path);
                      setSelectedFile(null);
                      setEditingContent('');
                    },
                  },
                ])
              }
            >
              <Ionicons
                name="trash-outline"
                size={20}
                color={theme.palette.error}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.editorContainer}>
          {isImg ? (
            <Image
              source={{ uri: String(selectedFile.content) }}
              style={styles.imagePreview}
            />
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
            />
          )}
        </View>
      </SafeAreaView>
    );
  }

  // EXPLORER-VIEW
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Code Explorer</Text>
          <Text style={styles.headerSubtitle}>
            {currentFolderPath ? `/${currentFolderPath}` : '/'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.newButton}
            onPress={() => setShowCreationDialog(true)}
          >
            <Ionicons
              name="add-circle-outline"
              size={18}
              color={theme.palette.background}
            />
            <Text style={styles.newButtonText}>Neu</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Breadcrumb
        currentPath={currentFolderPath}
        onNavigate={setCurrentFolderPath}
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color={theme.palette.primary}
          />
        </View>
      ) : (
        <FlatList
          data={currentFolderItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FileItem
              node={item}
              onPress={() => handleItemPress(item)}
              onLongPress={() => {
                if (item.file) deleteFile(item.file.path);
              }}
            />
          )}
          contentContainerStyle={
            currentFolderItems.length === 0 ? { flex: 1 } : undefined
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Ordner ist leer</Text>
            </View>
          }
        />
      )}

      <CreationDialog
        visible={showCreationDialog}
        currentPath={currentFolderPath}
        onClose={() => setShowCreationDialog(false)}
        onCreateFile={(name) => createFile(name, '')}
        onCreateFolder={(p: string) =>
          createFile(p.endsWith('/') ? p : `${p}/`, '')
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.palette.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.palette.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    justifyContent: 'space-between',
  },
  headerInfo: {
    flexShrink: 1,
    paddingRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.palette.text.primary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: { marginRight: 8 },
  iconButton: { padding: 4, marginLeft: 4 },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.palette.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  newButtonText: {
    color: theme.palette.background,
    fontWeight: '600',
    marginLeft: 4,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: theme.palette.text.secondary },
  editorContainer: {
    flex: 1,
    backgroundColor: theme.palette.code.background,
    padding: 10,
  },
  editorInput: {
    flex: 1,
    backgroundColor: theme.palette.code.background,
    color: theme.palette.text.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  imagePreview: {
    flex: 1,
    resizeMode: 'contain',
  },
});

export default CodeScreen;
