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
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../theme';
import { useProject, ProjectFile } from '../contexts/ProjectContext';

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
    console.log('buildFileTree: Keine Dateien vorhanden');
    return [];
  }

  console.log(`buildFileTree: Verarbeite ${files.length} Dateien`);

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
  console.log(`buildFileTree: Erstellt ${root.children!.length} Root-Knoten`);
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

const CodeScreen = () => {
  const navigation = useNavigation();
  const { projectData, isLoading } = useProject();
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);

  // ✅ FIX: useMemo hört auch auf lastModified
  const fileTree = useMemo(() => {
    if (projectData && projectData.files && Array.isArray(projectData.files)) {
      console.log(`CodeScreen: Baue FileTree mit ${projectData.files.length} Dateien`);
      return buildFileTree(projectData.files);
    }
    console.log('CodeScreen: Keine Dateien, leerer Baum');
    return [];
  }, [projectData?.files, projectData?.lastModified]);

  useEffect(() => {
    if (selectedFile) {
      const fileExists = projectData?.files?.some((f) => f.path === selectedFile.path);
      if (!fileExists) {
        console.log('CodeScreen: Ausgewählte Datei existiert nicht mehr, setze Auswahl zurück.');
        setSelectedFile(null);
      }
    }
  }, [projectData?.files, selectedFile]);

  useFocusEffect(
    useCallback(() => {
      console.log('CodeScreen: Fokus erhalten.');
    }, [])
  );

  const handleCopy = (content: string) => {
    Clipboard.setStringAsync(content);
    Alert.alert('Kopiert', 'Datei-Inhalt wurde in die Zwischenablage kopiert.');
  };

  const handleDebug = (file: ProjectFile) => {
    const contentString =
      typeof file.content === 'string' ? file.content : JSON.stringify(file.content, null, 2);
    console.log(`CodeScreen: Sende ${file.path} an Chat-Tab...`);
    const codeWithContext = `Datei: ${file.path}\n\n${contentString}`;
    /* @ts-ignore */
    navigation.navigate('Home', { screen: 'Chat', params: { debugCode: codeWithContext } });
  };

  if (isLoading && !projectData) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.palette.primary} />
        <Text style={styles.loadingText}>Projekt wird initialisiert...</Text>
      </View>
    );
  }

  if (selectedFile) {
    const fileContentString =
      typeof selectedFile.content === 'string'
        ? selectedFile.content
        : JSON.stringify(selectedFile.content, null, 2);

    return (
      <View style={styles.container}>
        <View style={styles.detailHeader}>
          <TouchableOpacity style={styles.headerButton} onPress={() => setSelectedFile(null)}>
            <Ionicons name="arrow-back" size={24} color={theme.palette.primary} />
            <Text style={styles.headerTitle} numberOfLines={1}>
              {selectedFile.path}
            </Text>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton} onPress={() => handleDebug(selectedFile)}>
              <Ionicons name="bug-outline" size={24} color={theme.palette.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={() => handleCopy(fileContentString)}>
              <Ionicons name="copy-outline" size={22} color={theme.palette.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.codeScrollView}>
          <Text style={styles.codeText} selectable={true}>
            {fileContentString}
          </Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.projectTitle}>{projectData ? projectData.name : 'Kein Projekt'}</Text>
      <Text style={styles.debugInfo}>
        Dateien: {projectData?.files?.length || 0} | Tree: {fileTree.length}
      </Text>

      <FlatList
        data={fileTree}
        keyExtractor={(item) => item?.id || Math.random().toString()}
        renderItem={({ item }) => <FileTreeItem node={item} onPressFile={setSelectedFile} level={0} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>Das Projekt ist leer.</Text>
            <Text style={styles.emptySubText}>
              Gehe zum Chat-Tab, um ein Projekt zu erstellen oder lade ein ZIP.
            </Text>
            {projectData && projectData.files && projectData.files.length > 0 && (
              <Text style={styles.debugText}>
                DEBUG: {projectData.files.length} Dateien vorhanden, aber Baum ist leer!
              </Text>
            )}
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.palette.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 10, color: theme.palette.text.primary, fontSize: 16 },
  projectTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.palette.text.primary,
    paddingHorizontal: 15,
    paddingTop: 20,
    paddingBottom: 5,
    backgroundColor: theme.palette.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
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
  debugText: { marginTop: 20, fontSize: 12, color: theme.palette.error, textAlign: 'center' },
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
    maxWidth: '70%',
  },
  headerActions: { flexDirection: 'row' },
  codeScrollView: { flex: 1, padding: 15 },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    color: '#e0e0e0',
    lineHeight: 20,
  },
});

export default CodeScreen;
