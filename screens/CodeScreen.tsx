import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Platform, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { theme } from '../theme';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useProject, ProjectFile } from '../contexts/ProjectContext'; // Importiere den Context

const CodeScreen = () => {
  const { projectFiles } = useProject(); // Liest die globalen Projektdateien
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Nur für initiales Laden
  const navigation = useNavigation();

  // --- KORRIGIERTER useFocusEffect ---
  // (Der Lade-Code wird jetzt aus dem ProjectContext geholt, daher ist kein async/await mehr nötig)
  useFocusEffect(
    useCallback(() => {
      console.log("CodeScreen: Fokus erhalten.");
      // Setze Ladezustand zurück, wenn wir zur Liste zurückkehren
      // (und stelle sicher, dass die Liste angezeigt wird, falls sie leer ist)
      if (projectFiles.length === 0) {
          setIsLoading(true); // Zeige Lade-Spinner/Platzhalter
      } else {
          setIsLoading(false);
      }
      
      // Wenn eine Datei ausgewählt war und wir zurückkommen, Auswahl aufheben
      // setSelectedFile(null); // Optional: Zurück zur Liste, wenn man Tab wechselt? Vorerst nicht.
      
      // Cleanup-Funktion
      return () => {
        // console.log("CodeScreen: Fokus verloren.");
      };
    }, [projectFiles]) // Abhängig von projectFiles
  );
  // --- ENDE KORREKTUR ---


  const copyToClipboard = async () => {
    if (selectedFile) {
      await Clipboard.setStringAsync(selectedFile.content);
      Alert.alert("Kopiert", `${selectedFile.path} wurde kopiert.`);
    }
  };

  const handleDebugCode = () => {
    if (!selectedFile) {
      Alert.alert("Fehler", "Keine Datei zum Debuggen ausgewählt.");
      return;
    }
    console.log(`CodeScreen: Sende ${selectedFile.path} an Chat-Tab...`);
    // @ts-ignore
    navigation.navigate('Chat', { debugCode: selectedFile.content });
  };

  // --- Render-Funktion für die Dateiliste ---
  const renderFileTree = () => (
    <View style={styles.container}>
      <View style={styles.header}>
          <Text style={styles.title}>Projektübersicht</Text>
           {isLoading && <ActivityIndicator size="small" color={theme.palette.primary} />}
      </View>
      <FlatList
        data={projectFiles}
        keyExtractor={(item) => item.path}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.fileItem}
            onPress={() => setSelectedFile(item)}
          >
            <Ionicons name={item.path.endsWith('.json') ? 'document-text-outline' : (item.path.includes('App') ? 'logo-react' : 'code-slash-outline')} size={20} color={theme.palette.text.secondary} />
            <Text style={styles.filePath}>{item.path}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={(
            <View style={styles.placeholderContainer}>
                <Text style={styles.placeholderText}>
                    Keine Projektdateien gefunden.
                </Text>
                <Text style={styles.placeholderSubText}>
                    Bitte die KI im Chat-Tab bitten, ein Projekt im JSON-Format zu generieren.
                </Text>
            </View>
        )}
      />
    </View>
  );

  // --- Render-Funktion für den Datei-Inhalt ---
  const renderFileContent = () => {
    if (!selectedFile) return null; // Sollte nicht passieren
    return (
      <View style={styles.container}>
        <View style={[styles.header, styles.fileHeader]}>
            <TouchableOpacity onPress={() => setSelectedFile(null)} style={styles.backButton}>
                 <Ionicons name="arrow-back-outline" size={24} color={theme.palette.primary} />
                 <Text style={styles.backButtonText} numberOfLines={1} ellipsizeMode="tail">{selectedFile.path}</Text>
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
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <Text selectable style={styles.codeText}>
                {selectedFile.content}
            </Text>
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <StatusBar style="light" />
      {selectedFile ? renderFileContent() : renderFileTree()}
    </SafeAreaView>
  );
};

// --- Styles angepasst ---
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.palette.background },
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, backgroundColor: theme.palette.card, borderBottomWidth: 1, borderBottomColor: theme.palette.card },
  fileHeader: { borderBottomWidth: 1, borderBottomColor: theme.palette.background },
  title: { fontSize: 18, fontWeight: 'bold', color: theme.palette.text.primary },
  backButton: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  backButtonText: { color: theme.palette.primary, fontSize: 16, marginLeft: 10, flexShrink: 1 },
  buttonContainer: { flexDirection: 'row', alignItems: 'center', flexGrow: 0 },
  copyButton: { padding: 5, marginLeft: 15 },
  fileItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: theme.palette.card },
  filePath: { color: theme.palette.text.primary, fontSize: 16, marginLeft: 15 },
  scrollContent: { padding: 15 },
  codeText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, color: theme.palette.text.primary, lineHeight: 18 },
  placeholderContainer: { // Container für Placeholder
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      marginTop: 50,
  },
  placeholderText: { fontSize: 16, color: theme.palette.text.secondary, textAlign: 'center', },
  placeholderSubText: { fontSize: 14, color: theme.palette.text.disabled, textAlign: 'center', marginTop: 10 },
});

export default CodeScreen;

