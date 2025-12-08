// screens/CodeScreen.tsx – Enhanced Code Explorer with advanced features
import React, { useState, useCallback, memo, useMemo } from 'react';
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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';

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

const getFileSize = (content: string): string => {
  const bytes = new Blob([content]).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const getLineCount = (content: string): number => {
  return content.split('\n').length;
};

// File Stats Component
const FileStats = memo(({ file }: { file: ProjectFile }) => {
  const content = typeof file.content === 'string'
    ? file.content
    : JSON.stringify(file.content, null, 2);
  
  const stats = useMemo(() => ({
    size: getFileSize(content),
    lines: getLineCount(content),
    chars: content.length,
    words: content.split(/\s+/).filter(Boolean).length,
  }), [content]);

  return (
    <View style={styles.fileStats}>
      <View style={styles.statItem}>
        <Ionicons name="document-text-outline" size={14} color={theme.palette.text.muted} />
        <Text style={styles.statText}>{stats.lines} Zeilen</Text>
      </View>
      <View style={styles.statItem}>
        <Ionicons name="text-outline" size={14} color={theme.palette.text.muted} />
        <Text style={styles.statText}>{stats.words} Wörter</Text>
      </View>
      <View style={styles.statItem}>
        <Ionicons name="analytics-outline" size={14} color={theme.palette.text.muted} />
        <Text style={styles.statText}>{stats.size}</Text>
      </View>
    </View>
  );
});

FileStats.displayName = 'FileStats';

// Header component for editor view
const EditorHeader = memo(({
  file,
  viewMode,
  showLineNumbers,
  onBack,
  onToggleView,
  onToggleLineNumbers,
  onSave,
  onDelete,
  onCopy,
  hasChanges,
}: {
  file: ProjectFile;
  viewMode: 'edit' | 'preview';
  showLineNumbers: boolean;
  onBack: () => void;
  onToggleView: () => void;
  onToggleLineNumbers: () => void;
  onSave: () => void;
  onDelete: () => void;
  onCopy: () => void;
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

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.editorActions}
        contentContainerStyle={styles.editorActionsContent}
      >
        {isCode && viewMode === 'preview' && (
          <TouchableOpacity 
            style={[styles.actionBtn, showLineNumbers && styles.actionBtnActive]} 
            onPress={onToggleLineNumbers}
          >
            <Ionicons
              name="list-outline"
              size={18}
              color={showLineNumbers ? theme.palette.primary : theme.palette.text.secondary}
            />
          </TouchableOpacity>
        )}

        {isCode && (
          <TouchableOpacity style={styles.actionBtn} onPress={onToggleView}>
            <Ionicons
              name={viewMode === 'edit' ? 'eye-outline' : 'create-outline'}
              size={18}
              color={theme.palette.text.secondary}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.actionBtn} onPress={onCopy}>
          <Ionicons
            name="copy-outline"
            size={18}
            color={theme.palette.text.secondary}
          />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionBtn, hasChanges && styles.actionBtnHighlight]} 
          onPress={onSave}
        >
          <Ionicons
            name="save-outline"
            size={18}
            color={hasChanges ? theme.palette.primary : theme.palette.text.secondary}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={onDelete}>
          <Ionicons name="trash-outline" size={18} color={theme.palette.error} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
});

EditorHeader.displayName = 'EditorHeader';

// Sort options
type SortOption = 'name' | 'type' | 'size' | 'modified';

// Explorer Header with search and sort
const ExplorerHeader = memo(({
  currentPath,
  fileCount,
  searchQuery,
  sortBy,
  onSearchChange,
  onSortChange,
  onCreateNew,
}: {
  currentPath: string;
  fileCount: number;
  searchQuery: string;
  sortBy: SortOption;
  onSearchChange: (text: string) => void;
  onSortChange: () => void;
  onCreateNew: () => void;
}) => {
  const sortIcon = sortBy === 'name' ? 'text' : sortBy === 'type' ? 'extension-puzzle' : sortBy === 'size' ? 'analytics' : 'time';
  
  return (
    <View style={styles.explorerHeaderContainer}>
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

        <View style={styles.explorerHeaderRight}>
          <TouchableOpacity style={styles.sortBtn} onPress={onSortChange}>
            <Ionicons name={sortIcon} size={18} color={theme.palette.text.secondary} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.newFileBtn} onPress={onCreateNew}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={theme.palette.text.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Dateien durchsuchen..."
          placeholderTextColor={theme.palette.text.muted}
          value={searchQuery}
          onChangeText={onSearchChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange('')} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color={theme.palette.text.muted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

ExplorerHeader.displayName = 'ExplorerHeader';

// Empty State
const EmptyState = memo(({ searchQuery }: { searchQuery?: string }) => (
  <View style={styles.emptyState}>
    <Ionicons 
      name={searchQuery ? "search-outline" : "document-outline"} 
      size={48} 
      color={theme.palette.text.muted} 
    />
    <Text style={styles.emptyStateTitle}>
      {searchQuery ? 'Keine Ergebnisse' : 'Ordner ist leer'}
    </Text>
    <Text style={styles.emptyStateSubtitle}>
      {searchQuery 
        ? `Keine Dateien gefunden für "${searchQuery}"`
        : 'Erstelle eine neue Datei oder navigiere zurück'
      }
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
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');

  const files = projectData?.files ?? [];
  const { currentFolderItems, currentFolderPath, setCurrentFolderPath } = useFileTree(files);

  const hasChanges = editingContent !== originalContent;

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    let items = [...currentFolderItems];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.path.toLowerCase().includes(query)
      );
    }

    // Sort items
    items.sort((a, b) => {
      // Folders first
      if (a.type === 'folder' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'folder') return 1;

      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'type': {
          const extA = getFileExtension(a.path);
          const extB = getFileExtension(b.path);
          return extA.localeCompare(extB) || a.name.localeCompare(b.name);
        }
        case 'size': {
          if (a.file && b.file) {
            const sizeA = typeof a.file.content === 'string' ? a.file.content.length : 0;
            const sizeB = typeof b.file.content === 'string' ? b.file.content.length : 0;
            return sizeB - sizeA;
          }
          return 0;
        }
        case 'modified':
          // Could implement if timestamp is available
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return items;
  }, [currentFolderItems, searchQuery, sortBy]);

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

    try {
      const updated: ProjectFile = {
        ...selectedFile,
        content: editingContent,
      };

      const nextFiles = files.map((f) => f.path === updated.path ? updated : f);

      await updateProjectFiles(nextFiles);
      setSelectedFile(updated);
      setOriginalContent(editingContent);
      Alert.alert('✅ Gespeichert', 'Datei wurde erfolgreich gespeichert.');
    } catch (error) {
      Alert.alert('❌ Fehler', 'Datei konnte nicht gespeichert werden.');
      console.error('Error saving file:', error);
    }
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
            try {
              await deleteFile(selectedFile.path);
              setSelectedFile(null);
              setEditingContent('');
              setOriginalContent('');
            } catch (error) {
              Alert.alert('❌ Fehler', 'Datei konnte nicht gelöscht werden.');
              console.error('Error deleting file:', error);
            }
          },
        },
      ]
    );
  }, [selectedFile, deleteFile]);

  const handleCopyContent = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(editingContent);
      Alert.alert('✅ Kopiert', 'Inhalt wurde in die Zwischenablage kopiert.');
    } catch (error) {
      Alert.alert('❌ Fehler', 'Inhalt konnte nicht kopiert werden.');
      console.error('Error copying content:', error);
    }
  }, [editingContent]);

  const handleToggleView = useCallback(() => {
    setViewMode((prev) => prev === 'edit' ? 'preview' : 'edit');
  }, []);

  const handleToggleLineNumbers = useCallback(() => {
    setShowLineNumbers((prev) => !prev);
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
          onPress: async () => {
            try {
              await deleteFile(node.file!.path);
            } catch (error) {
              Alert.alert('❌ Fehler', 'Datei konnte nicht gelöscht werden.');
              console.error('Error deleting file:', error);
            }
          },
        },
      ]
    );
  }, [deleteFile]);

  const handleSortChange = useCallback(() => {
    const options: SortOption[] = ['name', 'type', 'size'];
    const currentIndex = options.indexOf(sortBy);
    const nextIndex = (currentIndex + 1) % options.length;
    setSortBy(options[nextIndex]);
  }, [sortBy]);

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
            showLineNumbers={showLineNumbers}
            onBack={handleBack}
            onToggleView={handleToggleView}
            onToggleLineNumbers={handleToggleLineNumbers}
            onSave={handleSaveFile}
            onDelete={handleDeleteFile}
            onCopy={handleCopyContent}
            hasChanges={hasChanges}
          />

          <FileStats file={selectedFile} />

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
            <Animated.View 
              entering={FadeIn.duration(200)} 
              exiting={FadeOut.duration(200)}
              style={styles.unsavedBanner}
            >
              <Ionicons name="alert-circle" size={16} color={theme.palette.warning} />
              <Text style={styles.unsavedText}>Ungespeicherte Änderungen</Text>
            </Animated.View>
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
        searchQuery={searchQuery}
        sortBy={sortBy}
        onSearchChange={setSearchQuery}
        onSortChange={handleSortChange}
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
            data={filteredAndSortedItems}
            keyExtractor={keyExtractor}
            renderItem={renderFileItem}
            contentContainerStyle={filteredAndSortedItems.length === 0 ? { flex: 1 } : styles.listContent}
            ListEmptyComponent={<EmptyState searchQuery={searchQuery} />}
            showsVerticalScrollIndicator={false}
            initialNumToRender={20}
            maxToRenderPerBatch={15}
            windowSize={7}
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
  explorerHeaderContainer: {
    backgroundColor: theme.palette.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  explorerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  explorerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
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
  explorerHeaderRight: {
    flexDirection: 'row',
    gap: 8,
  },
  sortBtn: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: theme.palette.background,
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

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    backgroundColor: theme.palette.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.palette.text.primary,
  },
  clearBtn: {
    padding: 4,
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

  // File Stats
  fileStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: theme.palette.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
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
    maxWidth: '40%',
  },
  editorActionsContent: {
    flexDirection: 'row',
    gap: 4,
  },
  actionBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: theme.palette.background,
  },
  actionBtnActive: {
    backgroundColor: theme.palette.primarySoft,
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
