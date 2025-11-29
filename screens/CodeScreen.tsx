// screens/CodeScreen.tsx - MIT KORREKTEM THEME UND SYNTAX-VALIDIERUNG!
import React, { useState, useMemo, useEffect } from 'react';
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
  KeyboardAvoidingView,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../theme';
import { useProject } from '../contexts/ProjectContext';
import { ProjectFile } from '../contexts/types';
import { SyntaxHighlighter } from '../components/SyntaxHighlighter';
import { buildFileTree, findFolderContent, TreeNode } from '../components/FileTree';
import { Breadcrumb } from '../components/Breadcrumb';
import { FileItem } from '../components/FileItem';
import { CreationDialog } from '../components/CreationDialog';

const CodeScreen = () => {
  const {
    projectData,
    isLoading,
    updateProjectFiles,
    createFile,
    deleteFile,
    renameFile,
  } = useProject();

  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [currentFolderPath, setCurrentFolderPath] = useState<string>('');
  const [showCreationDialog, setShowCreationDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('preview');
  const [syntaxError, setSyntaxError] = useState<string | null>(null);

  const fileTree = useMemo(() => {
    if (projectData?.files) return buildFileTree(projectData.files);
    return [];
  }, [projectData?.files]);

  const currentFolderItems = useMemo(() => {
    return findFolderContent(fileTree, currentFolderPath);
  }, [fileTree, currentFolderPath]);

  // SYNTAX VALIDATION - Prüft Code auf Fehler
  const validateSyntax = (code: string, filePath: string): string | null => {
    if (!filePath.match(/\.(jsx?|tsx?)$/)) return null;

    try {
      // Basis Syntax Check für JavaScript/TypeScript
      // Prüfe auf ungeschlossene Klammern
      const openBrackets = (code.match(/[\[{(]/g) || []).length;
      const closeBrackets = (code.match(/[\]})]/g) || []).length;

      if (openBrackets !== closeBrackets) {
        return `Ungleiche Anzahl von Klammern: ${openBrackets} geöffnet, ${closeBrackets} geschlossen`;
      }

      // Prüfe auf ungeschlossene Strings
      const quotes = code.match(/["'`]/g) || [];
      if (quotes.length % 2 !== 0) {
        return 'Ungeschlossene String-Anführungszeichen gefunden';
      }

      return null;
    } catch (error) {
      return 'Syntax-Fehler erkannt';
    }
  };

  // Prüfe Syntax beim Tippen
  useEffect(() => {
    if (selectedFile && viewMode === 'edit') {
      const error = validateSyntax(editingContent, selectedFile.path);
      setSyntaxError(error);
    }
  }, [editingContent, selectedFile, viewMode]);

  const handleItemPress = (node: TreeNode) => {
    if (node.type === 'folder') {
      setCurrentFolderPath(node.path);
    } else if (node.file) {
      const contentString =
        typeof node.file.content === 'string'
          ? node.file.content
          : JSON.stringify(node.file.content, null, 2);
      setSelectedFile(node.file);
      setEditingContent(contentString);
      setViewMode('preview');
      setSyntaxError(null);
    }
  };

  const handleItemLongPress = (node: TreeNode) => {
    const options = [
      {
        text: 'Löschen',
        style: 'destructive' as const,
        onPress: () => {
          Alert.alert(
            'Löschen bestätigen',
            `${node.type === 'folder' ? 'Ordner' : 'Datei'} "${node.name}" wirklich löschen?`,
            [
              { text: 'Abbrechen', style: 'cancel' },
              {
                text: 'Löschen',
                style: 'destructive',
                onPress: () => {
                  if (node.type === 'file' && node.file) {
                    deleteFile(node.file.path);
                    if (selectedFile?.path === node.file.path) {
                      setSelectedFile(null);
                      setEditingContent('');
                    }
                  }
                },
              },
            ],
          );
        },
      },
      { text: 'Abbrechen', style: 'cancel' as const },
    ];

    Alert.alert(node.name, 'Aktion wählen:', options);
  };

  const handleCreateFile = (name: string) => {
    const fullPath = currentFolderPath ? `${currentFolderPath}/${name}` : name;
    const ext = name.includes('.') ? '' : '.tsx';
    const finalPath = fullPath + ext;
    createFile(finalPath, `// ${finalPath}\n`);
    handleSelectFile({ path: finalPath, content: `// ${finalPath}\n` });
  };

  const handleCreateFolder = (name: string) => {
    const fullPath = currentFolderPath ? `${currentFolderPath}/${name}` : name;
    createFile(`${fullPath}/.gitkeep`, '');
    Alert.alert('Erfolg', `Ordner "${name}" erstellt`);
  };

  const handleSelectFile = (file: ProjectFile) => {
    const contentString =
      typeof file.content === 'string'
        ? file.content
        : JSON.stringify(file.content, null, 2);
    setSelectedFile(file);
    setEditingContent(contentString);
    setSyntaxError(null);
  };

  const handleSaveFile = () => {
    if (!selectedFile) return;

    // Prüfe Syntax vor dem Speichern
    const error = validateSyntax(editingContent, selectedFile.path);
    if (error) {
      Alert.alert('Syntax-Warnung', `${error}\n\nTrotzdem speichern?`, [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Trotzdem speichern',
          style: 'destructive',
          onPress: () => {
            updateProjectFiles([{ path: selectedFile.path, content: editingContent }]);
            setSelectedFile((prev: ProjectFile | null) =>
              prev ? { ...prev, content: editingContent } : null,
            );
            Alert.alert('Gespeichert', selectedFile.path);
          },
        },
      ]);
      return;
    }

    updateProjectFiles([{ path: selectedFile.path, content: editingContent }]);
    setSelectedFile((prev: ProjectFile | null) =>
      prev ? { ...prev, content: editingContent } : null,
    );
    Alert.alert('Gespeichert', selectedFile.path);
  };

  const handleCopy = (content: string) => {
    Clipboard.setStringAsync(content);
    Alert.alert('Kopiert', 'Code in Zwischenablage kopiert');
  };

  if (isLoading && !projectData) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.palette.primary} />
        <Text style={styles.loadingText}>Projekt wird geladen...</Text>
      </SafeAreaView>
    );
  }

  // EDITOR VIEW
  if (selectedFile) {
    const isDirty = selectedFile.content !== editingContent;
    const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(selectedFile.path);
    const isCodeFile = /\.(tsx?|jsx?|json|md|css|scss|html|xml|yaml|yml)$/i.test(
      selectedFile.path,
    );

    if (isImage) {
      const base64Content = typeof editingContent === 'string' ? editingContent : '';
      const imageUri = base64Content.startsWith('data:image')
        ? base64Content
        : `data:image/png;base64,${base64Content}`;

      return (
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.editorHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setSelectedFile(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={theme.palette.primary} />
              <Text style={styles.fileName} numberOfLines={1}>
                {selectedFile.path}
              </Text>
            </TouchableOpacity>

            <View style={styles.editorActions}>
              <TouchableOpacity
                onPress={() => handleCopy(editingContent)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="copy-outline" size={22} color={theme.palette.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.imageScrollContainer}>
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: imageUri }}
                style={styles.imagePreview}
                resizeMode="contain"
              />
              <Text style={styles.imageInfo}>
                {selectedFile.path} • {(base64Content.length / 1024).toFixed(1)} KB
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.editorHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setSelectedFile(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={theme.palette.primary} />
              <Text style={styles.fileName} numberOfLines={1}>
                {selectedFile.path}
                {isDirty ? ' *' : ''}
              </Text>
            </TouchableOpacity>

            <View style={styles.editorActions}>
              {isCodeFile && (
                <TouchableOpacity
                  onPress={() =>
                    setViewMode((prev) => (prev === 'edit' ? 'preview' : 'edit'))
                  }
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={viewMode === 'edit' ? 'eye-outline' : 'create-outline'}
                    size={22}
                    color={theme.palette.primary}
                  />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => handleCopy(editingContent)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="copy-outline" size={22} color={theme.palette.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveFile}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={isDirty ? 'save' : 'save-outline'}
                  size={22}
                  color={isDirty ? theme.palette.warning : theme.palette.primary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Syntax Error Anzeige */}
          {syntaxError && viewMode === 'edit' && (
            <View style={styles.errorBar}>
              <Ionicons name="warning" size={16} color={theme.palette.error} />
              <Text style={styles.errorText}>{syntaxError}</Text>
            </View>
          )}

          {viewMode === 'edit' ? (
            <TextInput
              style={[styles.codeEditor, syntaxError && styles.codeEditorError]}
              value={editingContent}
              onChangeText={setEditingContent}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              textAlignVertical="top"
              placeholder="// Code eingeben..."
              placeholderTextColor={theme.palette.text.secondary}
            />
          ) : (
            <ScrollView style={styles.previewContainer}>
              <SyntaxHighlighter code={editingContent} />
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // FILE EXPLORER VIEW
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.explorerHeader}>
        <Text style={styles.projectTitle} numberOfLines={1}>
          {projectData?.name || 'Kein Projekt'}
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCreationDialog(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <Breadcrumb currentPath={currentFolderPath} onNavigate={setCurrentFolderPath} />

      <FlatList
        data={currentFolderItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FileItem
            node={item}
            onPress={() => handleItemPress(item)}
            onLongPress={() => handleItemLongPress(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="folder-open-outline"
              size={48}
              color={theme.palette.text.secondary}
            />
            <Text style={styles.emptyText}>Dieser Ordner ist leer</Text>
            <TouchableOpacity
              style={styles.createFirstButton}
              onPress={() => setShowCreationDialog(true)}
            >
              <Text style={styles.createFirstButtonText}>Erste Datei erstellen</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <CreationDialog
        visible={showCreationDialog}
        currentPath={currentFolderPath}
        onClose={() => setShowCreationDialog(false)}
        onCreateFile={handleCreateFile}
        onCreateFolder={handleCreateFolder}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.palette.text.secondary,
  },
  explorerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.palette.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  projectTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.palette.text.primary,
    flex: 1,
    marginRight: 12,
  },
  addButton: {
    backgroundColor: theme.palette.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.palette.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    minHeight: 56,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.palette.text.primary,
    marginLeft: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    flex: 1,
  },
  editorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingLeft: 8,
  },
  errorBar: {
    backgroundColor: `${theme.palette.error}20`,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: theme.palette.error,
    fontSize: 13,
    flex: 1,
  },
  codeEditor: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background,
    textAlignVertical: 'top',
  },
  codeEditorError: {
    backgroundColor: `${theme.palette.error}05`,
  },
  previewContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.palette.card,
  },
  imageScrollContainer: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    minHeight: 400,
  },
  imagePreview: {
    width: '100%',
    height: undefined,
    aspectRatio: 1,
    maxHeight: 500,
    borderRadius: 8,
    backgroundColor: theme.palette.card,
  },
  imageInfo: {
    marginTop: 16,
    fontSize: 14,
    color: theme.palette.text.secondary,
    textAlign: 'center',
  },
  listContent: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: theme.palette.text.secondary,
    marginTop: 16,
    marginBottom: 24,
  },
  createFirstButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: theme.palette.primary,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  createFirstButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});

export default CodeScreen;
