// screens/CodeScreen.tsx - MODERN MOBILE FILE EDITOR WITH EXPORT
import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { theme } from '../theme';
import { useProject } from '../contexts/ProjectContext';
import { ProjectFile } from '../contexts/types';
import { SyntaxHighlighter } from '../components/SyntaxHighlighter';
import { buildFileTree, findFolderContent, TreeNode } from '../components/FileTree';
import { Breadcrumb } from '../components/Breadcrumb';
import { FileItem } from '../components/FileItem';
import { CreationDialog } from '../components/CreationDialog';
import { FileActionsModal } from '../components/FileActionsModal';
import { validateSyntax, validateCodeQuality, SyntaxError as ValidationError } from '../utils/syntaxValidator';

type ViewState = 'explorer' | 'editor' | 'image';

const CodeScreen = () => {
  const {
    projectData,
    isLoading,
    updateProjectFiles,
    createFile,
    deleteFile,
    renameFile,
  } = useProject();

  // Editor State
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('preview');
  const [syntaxErrors, setSyntaxErrors] = useState<ValidationError[]>([]);

  // Explorer State
  const [currentFolderPath, setCurrentFolderPath] = useState<string>('');
  const [showCreationDialog, setShowCreationDialog] = useState(false);

  // Selection & Export State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  // Actions Modal State
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [actionTargetFile, setActionTargetFile] = useState<ProjectFile | null>(null);

  const fileTree = useMemo(() => {
    if (projectData?.files) return buildFileTree(projectData.files);
    return [];
  }, [projectData?.files]);

  const currentFolderItems = useMemo(() => {
    return findFolderContent(fileTree, currentFolderPath);
  }, [fileTree, currentFolderPath]);

  const allFolders = useMemo(() => {
    const folders: string[] = [];
    const extractFolders = (nodes: TreeNode[], prefix = '') => {
      nodes.forEach(node => {
        if (node.type === 'folder') {
          folders.push(node.path);
          if (node.children) {
            extractFolders(node.children, node.path);
          }
        }
      });
    };
    extractFolders(fileTree);
    return folders;
  }, [fileTree]);

  // Validate syntax while editing (with debounce)
  useEffect(() => {
    if (!selectedFile || viewMode !== 'edit' || !editingContent.trim()) {
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
      } catch (error) {
        // Silently handle validation errors
        setSyntaxErrors([]);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [editingContent, selectedFile, viewMode]);

  // File Selection Handlers
  const toggleFileSelection = (filePath: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filePath)) {
        newSet.delete(filePath);
      } else {
        newSet.add(filePath);
      }
      return newSet;
    });
  };

  const selectAllFiles = () => {
    const allFiles = projectData?.files.filter(f => !f.path.includes('node_modules')).map(f => f.path) || [];
    setSelectedFiles(new Set(allFiles));
  };

  const deselectAllFiles = () => {
    setSelectedFiles(new Set());
  };

  // Export Functionality
  const exportSelectedFilesAsTxt = async () => {
    if (selectedFiles.size === 0) {
      Alert.alert('Keine Dateien', 'Bitte wählen Sie mindestens eine Datei zum Export aus');
      return;
    }

    try {
      const files = projectData?.files.filter(f => selectedFiles.has(f.path)) || [];

      let content = `# ${projectData?.name || 'Project'} - Code Export\n`;
      content += `# Erstellt am: ${new Date().toLocaleString('de-DE')}\n`;
      content += `# Anzahl Dateien: ${files.length}\n`;
      content += `\n${'='.repeat(80)}\n\n`;

      files.forEach((file, index) => {
        const fileContent = typeof file.content === 'string'
          ? file.content
          : JSON.stringify(file.content, null, 2);

        content += `\n### DATEI ${index + 1}: ${file.path}\n`;
        content += `${'─'.repeat(80)}\n\n`;
        content += fileContent;
        content += `\n\n${'='.repeat(80)}\n`;
      });

      const fileName = `${projectData?.name || 'export'}_${Date.now()}.txt`;

      // ✅ TS-safe across Expo versions (some type defs are missing these fields)
      const baseDir =
        (FileSystem as any).documentDirectory ??
        (FileSystem as any).cacheDirectory ??
        '';
      const fileUri = `${baseDir}${fileName}`;

      const encoding =
        (FileSystem as any).EncodingType?.UTF8 ?? 'utf8';

      await (FileSystem as any).writeAsStringAsync(fileUri, content, {
        encoding,
      });

      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: 'Code exportieren',
        });
      } else {
        Alert.alert('✅ Exportiert', `Datei gespeichert als: ${fileName}`);
      }

      // Exit selection mode
      setSelectionMode(false);
      setSelectedFiles(new Set());
    } catch (error) {
      Alert.alert('Fehler', 'Export fehlgeschlagen: ' + (error as Error).message);
    }
  };

  // File Actions
  const handleItemPress = useCallback((node: TreeNode) => {
    if (selectionMode && node.type === 'file' && node.file) {
      toggleFileSelection(node.file.path);
      return;
    }

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
      setSyntaxErrors([]);
    }
  }, [selectionMode]);

  const handleItemLongPress = (node: TreeNode) => {
    if (selectionMode) return;

    if (node.type === 'folder') {
      // Folder actions
      Alert.alert(
        node.name,
        'Ordner-Aktion wählen:',
        [
          {
            text: 'Löschen',
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                'Ordner löschen',
                `Ordner "${node.name}" und alle Inhalte wirklich löschen?`,
                [
                  { text: 'Abbrechen', style: 'cancel' },
                  {
                    text: 'Löschen',
                    style: 'destructive',
                    onPress: () => {
                      // Delete all files in folder
                      const filesToDelete = projectData?.files.filter(f =>
                        f.path.startsWith(node.path + '/')
                      ) || [];
                      filesToDelete.forEach(f => deleteFile(f.path));
                    },
                  },
                ],
              );
            },
          },
          { text: 'Abbrechen', style: 'cancel' },
        ]
      );
    } else if (node.file) {
      setActionTargetFile(node.file);
      setShowActionsModal(true);
    }
  };

  const handleRenameFile = (newName: string) => {
    if (!actionTargetFile) return;

    const oldPath = actionTargetFile.path;
    const pathParts = oldPath.split('/');
    pathParts[pathParts.length - 1] = newName;
    const newPath = pathParts.join('/');

    renameFile(oldPath, newPath);

    if (selectedFile?.path === oldPath) {
      setSelectedFile({ ...actionTargetFile, path: newPath });
    }
  };

  const handleMoveFile = (targetFolder: string) => {
    if (!actionTargetFile) return;

    const fileName = actionTargetFile.path.split('/').pop() || '';
    const newPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;

    renameFile(actionTargetFile.path, newPath);

    if (selectedFile?.path === actionTargetFile.path) {
      setSelectedFile({ ...actionTargetFile, path: newPath });
    }
  };

  const handleDeleteFile = () => {
    if (!actionTargetFile) return;

    deleteFile(actionTargetFile.path);

    if (selectedFile?.path === actionTargetFile.path) {
      setSelectedFile(null);
      setEditingContent('');
    }
  };

  const handleDuplicateFile = () => {
    if (!actionTargetFile) return;

    const ext = actionTargetFile.path.split('.').pop() || '';
    const baseName = actionTargetFile.path.replace(`.${ext}`, '');
    const newPath = `${baseName}_copy.${ext}`;

    createFile(newPath, actionTargetFile.content);
    Alert.alert('✅ Dupliziert', `Neue Datei erstellt: ${newPath}`);
  };

  const handleCreateFile = (name: string) => {
    const fullPath = currentFolderPath ? `${currentFolderPath}/${name}` : name;
    const ext = name.includes('.') ? '' : '.tsx';
    const finalPath = fullPath + ext;
    createFile(finalPath, `// ${finalPath}\n`);

    // Auto-open new file
    const newFile: ProjectFile = { path: finalPath, content: `// ${finalPath}\n` };
    setSelectedFile(newFile);
    setEditingContent(`// ${finalPath}\n`);
    setViewMode('edit');
  };

  const handleCreateFolder = (name: string) => {
    const fullPath = currentFolderPath ? `${currentFolderPath}/${name}` : name;
    createFile(`${fullPath}/.gitkeep`, '');
    Alert.alert('✅ Erfolg', `Ordner "${name}" erstellt`);
  };

  const handleSaveFile = useCallback(() => {
    if (!selectedFile) return;

    try {
      const errors = validateSyntax(editingContent, selectedFile.path);
      const criticalErrors = errors.filter((e) => e.severity === 'error');

      if (criticalErrors.length > 0) {
        const errorList = criticalErrors.map((e) => `• ${e.message}`).join('\n');
        Alert.alert(
          'Syntax-Fehler',
          `Die folgenden Fehler wurden gefunden:\n\n${errorList}\n\nTrotzdem speichern?`,
          [
            { text: 'Abbrechen', style: 'cancel' },
            {
              text: 'Trotzdem speichern',
              style: 'destructive',
              onPress: () => {
                updateProjectFiles([{ path: selectedFile.path, content: editingContent }]);
                setSelectedFile((prev) => (prev ? { ...prev, content: editingContent } : null));
                Alert.alert('✅ Gespeichert', selectedFile.path);
              },
            },
          ]
        );
        return;
      }

      updateProjectFiles([{ path: selectedFile.path, content: editingContent }]);
      setSelectedFile((prev) => (prev ? { ...prev, content: editingContent } : null));
      Alert.alert('✅ Gespeichert', selectedFile.path);
    } catch (error) {
      Alert.alert('Fehler', 'Datei konnte nicht gespeichert werden.');
    }
  }, [selectedFile, editingContent, updateProjectFiles]);

  const handleCopy = useCallback((content: string) => {
    Clipboard.setStringAsync(content);
    Alert.alert('✅ Kopiert', 'Code in Zwischenablage kopiert');
  }, []);

  if (isLoading && !projectData) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.palette.primary} />
        <Text style={styles.loadingText}>Projekt wird geladen...</Text>
      </SafeAreaView>
    );
  }

  // ==================== IMAGE VIEWER ====================
  if (selectedFile && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(selectedFile.path)) {
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

          <TouchableOpacity
            onPress={() => handleCopy(editingContent)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="copy-outline" size={22} color={theme.palette.primary} />
          </TouchableOpacity>
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

  // ==================== CODE EDITOR (FULLSCREEN) ====================
  if (selectedFile) {
    const isDirty = selectedFile.content !== editingContent;
    const isCodeFile = /\.(tsx?|jsx?|json|md|css|scss|html|xml|yaml|yml)$/i.test(
      selectedFile.path,
    );

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* HEADER */}
          <View style={styles.editorHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                if (isDirty) {
                  Alert.alert(
                    'Ungespeicherte Änderungen',
                    'Möchten Sie die Änderungen speichern?',
                    [
                      { text: 'Verwerfen', style: 'destructive', onPress: () => setSelectedFile(null) },
                      { text: 'Speichern', onPress: () => { handleSaveFile(); setSelectedFile(null); } },
                      { text: 'Abbrechen', style: 'cancel' },
                    ]
                  );
                } else {
                  setSelectedFile(null);
                }
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={theme.palette.primary} />
              <Text style={styles.fileName} numberOfLines={1}>
                {selectedFile.path.split('/').pop()}
                {isDirty ? ' •' : ''}
              </Text>
            </TouchableOpacity>

            <View style={styles.editorActions}>
              {isCodeFile && (
                <TouchableOpacity
                  onPress={() =>
                    setViewMode((prev) => (prev === 'edit' ? 'preview' : 'edit'))
                  }
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.actionButton}
                >
                  <Ionicons
                    name={viewMode === 'edit' ? 'eye' : 'create'}
                    size={22}
                    color={theme.palette.primary}
                  />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => handleCopy(editingContent)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.actionButton}
              >
                <Ionicons name="copy-outline" size={22} color={theme.palette.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveFile}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={[styles.actionButton, isDirty && styles.actionButtonHighlight]}
              >
                <Ionicons
                  name={isDirty ? 'save' : 'checkmark-circle'}
                  size={22}
                  color={isDirty ? '#fff' : theme.palette.success}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* SYNTAX ERRORS */}
          {syntaxErrors.length > 0 && viewMode === 'edit' && (
            <ScrollView
              style={styles.errorContainer}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {syntaxErrors.map((error, index) => (
                <View
                  key={index}
                  style={[
                    styles.errorBadge,
                    error.severity === 'error' ? styles.errorBadgeError : styles.errorBadgeWarning,
                  ]}
                >
                  <Ionicons
                    name={error.severity === 'error' ? 'close-circle' : 'warning'}
                    size={14}
                    color={error.severity === 'error' ? theme.palette.error : theme.palette.warning}
                  />
                  <Text
                    style={[
                      styles.errorBadgeText,
                      error.severity === 'error' ? styles.errorTextError : styles.errorTextWarning,
                    ]}
                  >
                    {error.line ? `Line ${error.line}: ` : ''}
                    {error.message}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* EDITOR / PREVIEW */}
          {viewMode === 'edit' ? (
            <TextInput
              style={[
                styles.codeEditor,
                syntaxErrors.some((e) => e.severity === 'error') && styles.codeEditorError,
              ]}
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

  // ==================== FILE EXPLORER ====================
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.explorerHeader}>
        {selectionMode ? (
          <>
            <View style={styles.selectionHeader}>
              <TouchableOpacity
                onPress={() => {
                  setSelectionMode(false);
                  setSelectedFiles(new Set());
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={theme.palette.text.primary} />
              </TouchableOpacity>
              <Text style={styles.selectionCount}>
                {selectedFiles.size} ausgewählt
              </Text>
            </View>
            <View style={styles.selectionActions}>
              <TouchableOpacity
                onPress={selectAllFiles}
                style={styles.selectionButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.selectionButtonText}>Alle</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={deselectAllFiles}
                style={styles.selectionButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.selectionButtonText}>Keine</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={exportSelectedFilesAsTxt}
                style={[styles.exportButton, selectedFiles.size === 0 && styles.exportButtonDisabled]}
                disabled={selectedFiles.size === 0}
              >
                <Ionicons name="download" size={20} color="#fff" />
                <Text style={styles.exportButtonText}>Export</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.projectTitle} numberOfLines={1}>
              {projectData?.name || 'Kein Projekt'}
            </Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setSelectionMode(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="checkbox-outline" size={24} color={theme.palette.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowCreationDialog(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* BREADCRUMB */}
      <Breadcrumb currentPath={currentFolderPath} onNavigate={setCurrentFolderPath} />

      {/* FILE LIST */}
      <FlatList
        data={currentFolderItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FileItem
            node={item}
            onPress={() => handleItemPress(item)}
            onLongPress={() => handleItemLongPress(item)}
            isSelected={item.file ? selectedFiles.has(item.file.path) : false}
            selectionMode={selectionMode}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="folder-open-outline"
              size={64}
              color={theme.palette.text.secondary}
            />
            <Text style={styles.emptyText}>Dieser Ordner ist leer</Text>
            <TouchableOpacity
              style={styles.createFirstButton}
              onPress={() => setShowCreationDialog(true)}
            >
              <Ionicons name="add-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.createFirstButtonText}>Erste Datei erstellen</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* DIALOGS */}
      <CreationDialog
        visible={showCreationDialog}
        currentPath={currentFolderPath}
        onClose={() => setShowCreationDialog(false)}
        onCreateFile={handleCreateFile}
        onCreateFolder={handleCreateFolder}
      />

      <FileActionsModal
        visible={showActionsModal}
        fileName={actionTargetFile?.path.split('/').pop() || ''}
        filePath={actionTargetFile?.path || ''}
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

  // ==================== EXPLORER HEADER ====================
  explorerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: theme.palette.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    minHeight: 60,
  },
  projectTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.palette.text.primary,
    flex: 1,
    marginRight: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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

  // ==================== SELECTION MODE ====================
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  selectionCount: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: theme.palette.background,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  selectionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.palette.primary,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.palette.success,
  },
  exportButtonDisabled: {
    opacity: 0.5,
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  // ==================== EDITOR HEADER ====================
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
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
  },
  editorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: theme.palette.background,
  },
  actionButtonHighlight: {
    backgroundColor: theme.palette.primary,
  },

  // ==================== SYNTAX ERRORS ====================
  errorContainer: {
    backgroundColor: theme.palette.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  errorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  errorBadgeError: {
    backgroundColor: `${theme.palette.error}15`,
    borderWidth: 1,
    borderColor: theme.palette.error,
  },
  errorBadgeWarning: {
    backgroundColor: `${theme.palette.warning}15`,
    borderWidth: 1,
    borderColor: theme.palette.warning,
  },
  errorBadgeText: {
    fontSize: 12,
    maxWidth: 300,
  },
  errorTextError: {
    color: theme.palette.error,
  },
  errorTextWarning: {
    color: theme.palette.warning,
  },

  // ==================== CODE EDITOR ====================
  codeEditor: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    paddingVertical: 16,
    backgroundColor: theme.palette.card,
  },

  // ==================== IMAGE VIEWER ====================
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

  // ==================== FILE LIST ====================
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: theme.palette.primary,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  createFirstButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});

export default CodeScreen;
