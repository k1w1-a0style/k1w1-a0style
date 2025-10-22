import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Platform, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { theme } from '../theme';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

// --- NEUE DATENSTRUKTUR ---
// Definiert, wie eine Datei in unserem Projekt-State aussieht
type ProjectFile = {
  path: string; // z.B. "src/components/Button.tsx"
  content: string; // Der Quellcode
};

// --- TESTDATEN (Platzhalter) ---
// Ein Dummy-Projekt, damit wir die UI bauen können.
// Später wird dies von der KI gefüllt.
const DUMMY_PROJECT: ProjectFile[] = [
  {
    path: 'package.json',
    content: `{
  "name": "meine-neue-app",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "expo": "~54.0.0",
    "react": "18.2.0",
    "react-native": "0.81.0"
  }
}`
  },
  {
    path: 'app.config.js',
    content: `module.exports = {
  expo: {
    name: "meine-neue-app",
    slug: "meine-neue-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
  }
};`
  },
  {
    path: 'src/App.tsx',
    content: `import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text>Hallo Welt!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});`
  },
];
// --- ENDE TESTDATEN ---


const CodeScreen = () => {
  // State für die Projektdateien (startet mit Dummy-Daten)
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>(DUMMY_PROJECT);
  // State, um zu wissen, welche Datei wir gerade ansehen
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [isLoading, setIsLoading] = useState(false); // Vorerst für zukünftige Ladevorgänge
  const navigation = useNavigation();

  // (Die alte useFocusEffect-Logik zum Laden von AsyncStorage ist jetzt entfernt)

  // --- Render-Funktion für die Dateiliste ---
  const renderFileTree = () => (
    <View>
      <Text style={styles.listHeader}>Projektdateien</Text>
      <FlatList
        data={projectFiles}
        keyExtractor={(item) => item.path}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.fileItem}
            onPress={() => setSelectedFile(item)} // Setze die ausgewählte Datei
          >
            <Ionicons name={item.path.endsWith('.json') ? 'document-text-outline' : 'logo-react'} size={20} color={theme.palette.text.secondary} />
            <Text style={styles.filePath}>{item.path}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  // --- Render-Funktion für den Datei-Inhalt ---
  const renderFileContent = () => {
    if (!selectedFile) return null; // Sollte nicht passieren, wenn diese Funktion aufgerufen wird

    const copyToClipboard = async () => {
        await Clipboard.setStringAsync(selectedFile.content);
        Alert.alert("Kopiert", `${selectedFile.path} wurde in die Zwischenablage kopiert.`);
    };

    const handleDebugCode = () => {
        console.log(`CodeScreen: Sende ${selectedFile.path} an Chat-Tab...`);
        // @ts-ignore
        navigation.navigate('Chat', { debugCode: selectedFile.content });
    };

    return (
      <View style={styles.container}>
        {/* Header für die Datei-Ansicht */}
        <View style={[styles.header, styles.fileHeader]}>
            <TouchableOpacity onPress={() => setSelectedFile(null)} style={styles.backButton}>
                 <Ionicons name="arrow-back-outline" size={24} color={theme.palette.primary} />
                 <Text style={styles.backButtonText}>Zurück zur Liste</Text>
            </TouchableOpacity>
            <View style={styles.buttonContainer}>
                 <TouchableOpacity onPress={handleDebugCode} style={styles.copyButton}>
                    <Ionicons name="bug-outline" size={24} color={theme.palette.primary} />
                 </TouchableOpacity>
                 <TouchableOpacity onPress={copyToClipboard} style={styles.copyButton}>
                    <Ionicons name="copy-outline" size={24} color={theme.palette.primary} />
                 </TouchableOpacity>
            </View>
        </View>
        {/* Code-Inhalt */}
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <Text selectable style={styles.codeText}>
                {selectedFile.content}
            </Text>
        </ScrollView>
      </View>
    );
  };

  // --- Haupt-Render ---
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <StatusBar style="light" />
      
      {/* Bedingtes Rendern: Zeige Liste ODER Inhalt */}
      {selectedFile ? renderFileContent() : renderFileTree()}
      
    </SafeAreaView>
  );
};

// --- NEUE STYLES ---
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.palette.background },
  container: { flex: 1 },
  header: { // Allgemeiner Header (wird jetzt in renderFileContent verwendet)
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.card,
    backgroundColor: theme.palette.card,
  },
  fileHeader: { // Spezieller Style für den Datei-Header
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.card,
  },
  backButton: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  backButtonText: {
      color: theme.palette.primary,
      fontSize: 16,
      marginLeft: 5,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copyButton: {
    padding: 5,
    marginLeft: 15,
  },
  listHeader: { // Titel für die Dateiliste
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.palette.text.primary,
    padding: 15,
    backgroundColor: theme.palette.card,
  },
  fileItem: { // Ein Eintrag in der Dateiliste
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.card,
  },
  filePath: {
    color: theme.palette.text.primary,
    fontSize: 16,
    marginLeft: 15,
  },
  scrollContent: { // Padding für den Code
    padding: 15,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    color: theme.palette.text.primary,
    lineHeight: 18,
  },
});

export default CodeScreen;

