import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../theme';
import { useProject, ProjectFile } from '../contexts/ProjectContext';

// (buildFileTree und FileTreeItem bleiben gleich)
type TreeNode = {
  id: string;
  name: string;
  path: string;
  children?: TreeNode[];
  file?: ProjectFile;
};

const buildFileTree = (files: ProjectFile[]): TreeNode[] => {
  const root: TreeNode = { id: 'root', name: 'root', path: '', children: [] };
  if (!files || !Array.isArray(files)) {
    return [];
  }
  files.forEach((file) => {
    if (!file || !file.path) return;
    let currentLevel = root.children!;
    const pathParts = file.path.split('/');
    pathParts.forEach((part, index) => {
      const isFile = index === pathParts.length - 1;
      const nodePath = pathParts.slice(0, index + 1).join('/');
      let existingNode = currentLevel.find(
        (node) => node.name === part && (isFile ? !!node.file : !!node.children)
      );
      if (!existingNode) {
        const newNode: TreeNode = {
          id: isFile ? file.path : `${nodePath}_folder`,
          name: part,
          path: nodePath,
        };
        if (isFile) {
          newNode.file = file;
          newNode.path = file.path;
          newNode.id = file.path;
        } else {
          newNode.children = [];
        }
        currentLevel.push(newNode);
        existingNode = newNode;
      }
      if (!isFile && existingNode.children) {
        currentLevel = existingNode.children;
      }
    });
  });
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.children && !b.children) return -1;
      if (!a.children && b.children) return 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => {
      if (node.children) sortNodes(node.children);
    });
  };
  sortNodes(root.children!);
  return root.children!;
};

const FileTreeItem: React.FC<{
  node: TreeNode;
  onPressFile: (file: ProjectFile) => void;
  level: number;
}> = React.memo(({ node, onPressFile, level }) => {
  const isFolder = !!node.children;
  const indentStyle = { paddingLeft: level * 20 };

  if (isFolder) {
    return (
      <View>
        <View style={[styles.treeItem, indentStyle]}>
          <Ionicons name="folder-outline" size={20} color={theme.palette.text.secondary} />
          <Text style={styles.treeItemText}>{node.name}</Text>
        </View>
        {node.children!.map((child) => (
          <FileTreeItem key={child.id} node={child} onPressFile={onPressFile} level={level + 1} />
        ))}
      </View>
    );
  }
  return (
    <TouchableOpacity style={[styles.treeItem, indentStyle]} onPress={() => onPressFile(node.file!)}>
      <Ionicons name="document-text-outline" size={20} color={theme.palette.primary} />
      <Text style={[styles.treeItemText, styles.fileText]}>{node.name}</Text>
    </TouchableOpacity>
  );
});


// ===================================================================
// KORRIGIERTER CODE SCREEN
// ===================================================================
const CodeScreen = () => {
  const navigation = useNavigation();
  const { projectData, isLoading, updateProjectFiles, createFile, deleteFile } = useProject();
  
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');

  const fileTree = useMemo(() => {
    if (projectData && projectData.files && Array.isArray(projectData.files)) {
      return buildFileTree(projectData.files);
    }
    return [];
  }, [projectData?.files, projectData?.lastModified]);

  const handleSelectFile = (file: ProjectFile) => {
    const contentString = typeof file.content === 'string'
        ? file.content
        : JSON.stringify(file.content, null, 2);
    setSelectedFile(file);
    setEditingContent(contentString);
  };

  const handleSaveFile = () => {
    if (!selectedFile) return;
    updateProjectFiles([{ path: selectedFile.path, content: editingContent }]);
    Alert.alert('Gespeichert', `${selectedFile.path} wurde gespeichert.`);
    
    // Aktualisiere den "sauberen" Zustand der Datei
    setSelectedFile(prev => prev ? {...prev, content: editingContent} : null);
  };

  const handleDeleteFile = () => {
    if (!selectedFile) return;
    Alert.alert(
      'Datei löschen?',
      `Soll ${selectedFile.path} wirklich gelöscht werden?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        { 
          text: 'Löschen', 
          style: 'destructive', 
          onPress: () => {
            deleteFile(selectedFile.path);
            setSelectedFile(null);
            setEditingContent('');
          } 
        },
      ]
    );
  };
  
  // KORRIGIERT: handleNewFile (funktioniert jetzt auf Android)
  const handleNewFile = () => {
    if (!projectData) return;
    // Erstelle einen eindeutigen Dateinamen
    let i = 0;
    let newPath = 'neue-datei.tsx';
    while (projectData.files.some(f => f.path === newPath)) {
      i++;
      newPath = `neue-datei(${i}).tsx`;
    }
    
    const newContent = '// Neue Datei: ' + newPath;
    createFile(newPath, newContent);
    // Wähle die neue Datei direkt aus
    handleSelectFile({ path: newPath, content: newContent });
  };

  // NEU: handleNewFolder
  const handleNewFolder = () => {
    if (!projectData) return;
    // Erstelle einen eindeutigen Ordnernamen
    let i = 0;
    let folderName = 'neuer-ordner';
    while (projectData.files.some(f => f.path.startsWith(folderName))) {
      i++;
      folderName = `neuer-ordner(${i})`;
    }
    
    const newPath = `${folderName}/.gitkeep`; // Platzhalterdatei
    const newContent = '';
    createFile(newPath, newContent);
    Alert.alert('Ordner erstellt', `Ordner '${folderName}' wurde erstellt (mit .gitkeep).`);
  };

  const handleDebug = (file: ProjectFile) => {
    const contentString = editingContent;
    console.log(`CodeScreen: Sende ${file.path} an Chat-Tab...`);
    const codeWithContext = `Datei: ${file.path}\n\n${contentString}`;
    /* @ts-ignore */
    navigation.navigate('Home', { screen: 'Chat', params: { debugCode: codeWithContext } });
  };
  
  const handleCopy = (content: string) => {
    Clipboard.setStringAsync(content);
    Alert.alert('Kopiert', 'Datei-Inhalt wurde in die Zwischenablage kopiert.');
  };

  if (isLoading && !projectData) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.palette.primary} />
        <Text style={styles.loadingText}>Projekt wird initialisiert...</Text>
      </View>
    );
  }

  // --- Editor-Ansicht ---
  if (selectedFile) {
    const isDirty = selectedFile.content !== editingContent;
    
    return (
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
      >
        <View style={styles.detailHeader}>
          <TouchableOpacity style={styles.headerButton} onPress={() => setSelectedFile(null)}>
            <Ionicons name="arrow-back" size={24} color={theme.palette.primary} />
            <Text style={styles.headerTitle} numberOfLines={1}>
              {selectedFile.path}
              {isDirty ? "*" : ""} 
            </Text>
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton} onPress={handleDeleteFile}>
              <Ionicons name="trash-outline" size={22} color={theme.palette.error} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={() => handleDebug(selectedFile)}>
              <Ionicons name="bug-outline" size={24} color={theme.palette.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={() => handleCopy(editingContent)}>
              <Ionicons name="copy-outline" size={22} color={theme.palette.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={handleSaveFile}>
              <Ionicons name="save-outline" size={22} color={isDirty ? theme.palette.warning : theme.palette.primary} />
            </TouchableOpacity>
          </View>
        </View>
        
        <TextInput
          style={styles.codeEditor}
          value={editingContent}
          onChangeText={setEditingContent}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          textAlignVertical="top"
        />
      </KeyboardAvoidingView>
    );
  }

  // --- Listen-Ansicht (KORRIGIERT) ---
  return (
    <View style={styles.container}>
      <View style={styles.listHeader}>
        <Text style={styles.projectTitle}>{projectData ? projectData.name : 'Kein Projekt'}</Text>
        <View style={styles.headerActions}>
          {/* NEU: Ordner-Button */}
          <TouchableOpacity style={styles.newFileButton} onPress={handleNewFolder}>
            <Ionicons name="folder-open-outline" size={24} color={theme.palette.primary} />
          </TouchableOpacity>
          {/* KORRIGIERT: Datei-Button */}
          <TouchableOpacity style={styles.newFileButton} onPress={handleNewFile}>
            <Ionicons name="add-outline" size={28} color={theme.palette.primary} />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.debugInfo}>
        Dateien: {projectData?.files?.length || 0} | Tree: {fileTree.length}
      </Text>
      
      <FlatList
        data={fileTree}
        keyExtractor={(item) => item?.id || Math.random().toString()}
        renderItem={({ item }) => <FileTreeItem node={item} onPressFile={handleSelectFile} level={0} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>Das Projekt ist leer.</Text>
            <Text style={styles.emptySubText}>
              Gehe zum Chat-Tab, um ein Projekt zu erstellen oder lade ein ZIP.
            </Text>
          </View>
        }
      />
    </View>
  );
};

// --- KORRIGIERTE STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.palette.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 10, color: theme.palette.text.primary, fontSize: 16 },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.palette.card,
    paddingHorizontal: 15,
    paddingTop: 20,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.palette.text.primary,
    flex: 1,
  },
  newFileButton: {
    padding: 8,
    marginLeft: 8,
  },
  debugInfo: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    paddingHorizontal: 15,
    paddingBottom: 10,
    backgroundColor: theme.palette.card,
  },
  treeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  treeItemText: { fontSize: 16, color: theme.palette.text.secondary, marginLeft: 10 },
  fileText: { color: theme.palette.text.primary },
  emptyText: { fontSize: 18, color: theme.palette.text.secondary, marginBottom: 10 },
  emptySubText: { fontSize: 14, color: theme.palette.text.disabled, textAlign: 'center' },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: theme.palette.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  headerButton: { padding: 8, flexDirection: 'row', alignItems: 'center' },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.palette.text.primary,
    marginLeft: 10,
    maxWidth: '50%', // Gekürzt, um Platz für MEHR Buttons zu machen
  },
  headerActions: { flexDirection: 'row' },
  codeEditor: {
    flex: 1,
    padding: 15,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    color: '#e0e0e0',
    lineHeight: 20,
    backgroundColor: theme.palette.background,
  },
});

export default CodeScreen;

