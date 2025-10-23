import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../theme';
import { useProject, ProjectFile, ProjectData } from '../contexts/ProjectContext';

// TreeNode (unverändert)
type TreeNode = { id: string; name: string; path: string; children?: TreeNode[]; file?: ProjectFile; };

// buildFileTree (robuster)
const buildFileTree = (files: ProjectFile[]): TreeNode[] => { 
  const root: TreeNode = { id: 'root', name: 'root', path: '', children: [] }; 
  if (!files || !Array.isArray(files)) return []; // Sicherheitscheck
  
  files.forEach(file => { 
    if (!file || !file.path) return; // Überspringe ungültige Dateien
    let currentLevel = root.children!; 
    const pathParts = file.path.split('/'); 
    pathParts.forEach((part, index) => { 
      const isFile = index === pathParts.length - 1; 
      let existingNode = currentLevel.find(node => node.name === part && (isFile ? !!node.file : !!node.children)); 
      if (!existingNode) { 
        const newNode: TreeNode = { id: file.path, name: part, path: file.path, }; 
        if (isFile) { 
          newNode.file = file; 
        } else { 
          newNode.children = []; 
        } 
        currentLevel.push(newNode); 
        existingNode = newNode; 
      } 
      if (!isFile && existingNode.children) { // Sicherer Zugriff auf children
          currentLevel = existingNode.children; 
      } 
    }); 
  }); 
  const sortNodes = (nodes: TreeNode[]) => { nodes.sort((a, b) => { if (a.children && !b.children) return -1; if (!a.children && b.children) return 1; return a.name.localeCompare(b.name); }); nodes.forEach(node => { if (node.children) sortNodes(node.children); }); }; 
  sortNodes(root.children!); 
  return root.children!; 
};

// FileTreeItem (unverändert)
const FileTreeItem: React.FC<{ node: TreeNode; onPressFile: (file: ProjectFile) => void; level: number }> = ({ node, onPressFile, level }) => { const isFolder = !!node.children; const indentStyle = { paddingLeft: level * 20 }; if (isFolder) { return ( <View> <View style={[styles.treeItem, indentStyle]}> <Ionicons name="folder-outline" size={20} color={theme.palette.text.secondary} /> <Text style={styles.treeItemText}>{node.name}</Text> </View> {node.children!.map(child => ( <FileTreeItem key={child.id} node={child} onPressFile={onPressFile} level={level + 1} /> ))} </View> ); } return ( <TouchableOpacity style={[styles.treeItem, indentStyle]} onPress={() => onPressFile(node.file!)}> <Ionicons name="document-text-outline" size={20} color={theme.palette.primary} /> <Text style={[styles.treeItemText, styles.fileText]}>{node.name}</Text> </TouchableOpacity> ); };

// Haupt-Screen
const CodeScreen = () => {
  const navigation = useNavigation();
  const { projectData, isLoading } = useProject(); // Angepasst
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [fileTree, setFileTree] = useState<TreeNode[]>([]);

  // useEffect (Loop-Fix)
  useEffect(() => {
      console.log("CodeScreen: ProjectData-Effekt ausgelöst.");
      if (projectData && projectData.files && Array.isArray(projectData.files)) { 
        console.log(`CodeScreen: Baue Baum mit ${projectData.files.length} Dateien neu.`);
        setFileTree(buildFileTree(projectData.files));
      } else {
        console.log("CodeScreen: ProjectData leer, setze leeren Baum.");
        setFileTree([]);
      }
      if (selectedFile) {
        const fileExists = projectData?.files?.some(f => f.path === selectedFile.path); 
        if (!fileExists) {
            console.log("CodeScreen: Ausgewählte Datei existiert nicht mehr, setze Auswahl zurück.");
            setSelectedFile(null);
        }
      }
  }, [projectData]); // Abhängigkeit nur von projectData

  useFocusEffect( useCallback(() => { console.log("CodeScreen: Fokus erhalten."); }, []) );

  // handleCopy, handleDebug (unverändert)
  const handleCopy = (content: string) => { Clipboard.setStringAsync(content); Alert.alert("Kopiert", "Datei-Inhalt wurde in die Zwischenablage kopiert."); };
  const handleDebug = (file: ProjectFile) => { 
      if(!file || typeof file.content !== 'string') {
          Alert.alert("Fehler", "Kann Dateiinhalt nicht lesen (ist kein String).");
          return;
      }
      console.log(`CodeScreen: Sende ${file.path} an Chat-Tab...`); 
      const codeWithContext = `Datei: ${file.path}\n\n${file.content}`; 
      /* @ts-ignore */ navigation.navigate('Home', { screen: 'Chat', params: { debugCode: codeWithContext } }); 
  };

  // Render-Logik
  if (isLoading && !projectData) { 
      return ( <View style={[styles.container, styles.centered]}> <ActivityIndicator size="large" color={theme.palette.primary} /> <Text style={styles.loadingText}>Projekt wird initialisiert...</Text> </View> ); 
  }
  
  if (selectedFile) { 
    // === SONNETS FIX: Stelle sicher, dass Content ein String ist ===
    const fileContentString = typeof selectedFile.content === 'string' 
        ? selectedFile.content 
        : JSON.stringify(selectedFile.content, null, 2);
    // === ENDE FIX ===
    return ( <View style={styles.container}> <View style={styles.detailHeader}> <TouchableOpacity style={styles.headerButton} onPress={() => setSelectedFile(null)}> <Ionicons name="arrow-back" size={24} color={theme.palette.primary} /> <Text style={styles.headerTitle} numberOfLines={1}>{selectedFile.path}</Text> </TouchableOpacity> <View style={styles.headerActions}> <TouchableOpacity style={styles.headerButton} onPress={() => handleDebug(selectedFile)}> <Ionicons name="bug-outline" size={24} color={theme.palette.primary} /> </TouchableOpacity> <TouchableOpacity style={styles.headerButton} onPress={() => handleCopy(fileContentString)}> <Ionicons name="copy-outline" size={22} color={theme.palette.primary} /> </TouchableOpacity> </View> </View> <ScrollView style={styles.codeScrollView}> <Text style={styles.codeText} selectable={true}> {fileContentString} </Text> </ScrollView> </View> ); 
  }
  
  return ( 
    <View style={styles.container}> 
      <Text style={styles.projectTitle}> {projectData ? projectData.name : "Kein Projekt"} </Text> 
      <FlatList data={fileTree} keyExtractor={(item) => item.id} renderItem={({ item }) => ( <FileTreeItem node={item} onPressFile={setSelectedFile} level={0} /> )} ListEmptyComponent={ <View style={styles.centered}> <Text style={styles.emptyText}>Das Projekt ist leer.</Text> <Text style={styles.emptySubText}>Gehe zum Chat-Tab, um ein Projekt zu erstellen oder lade ein ZIP.</Text> </View> } /> 
    </View> 
  );
};

// Styles (unverändert)
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: theme.palette.background }, centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }, loadingText: { marginTop: 10, color: theme.palette.text.primary, fontSize: 16 }, projectTitle: { fontSize: 18, fontWeight: 'bold', color: theme.palette.text.primary, paddingHorizontal: 15, paddingTop: 20, paddingBottom: 10, backgroundColor: theme.palette.card, borderBottomWidth: 1, borderBottomColor: theme.palette.border }, treeItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: theme.palette.border }, treeItemText: { fontSize: 16, color: theme.palette.text.secondary, marginLeft: 10 }, fileText: { color: theme.palette.text.primary }, emptyText: { fontSize: 18, color: theme.palette.text.secondary, marginBottom: 10 }, emptySubText: { fontSize: 14, color: theme.palette.text.disabled, textAlign: 'center' }, detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, backgroundColor: theme.palette.card, borderBottomWidth: 1, borderBottomColor: theme.palette.border }, headerButton: { padding: 8, flexDirection: 'row', alignItems: 'center' }, headerTitle: { fontSize: 18, fontWeight: 'bold', color: theme.palette.text.primary, marginLeft: 10, maxWidth: '70%' }, headerActions: { flexDirection: 'row' }, codeScrollView: { flex: 1, padding: 15 }, codeText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 14, color: '#e0e0e0', lineHeight: 20 }, });

export default CodeScreen;

