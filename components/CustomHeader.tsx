import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, StatusBar, ActivityIndicator } from 'react-native';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme, HEADER_HEIGHT } from '../theme';
import { DrawerHeaderProps } from '@react-navigation/drawer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureSupabaseClient } from '../lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { zip } from 'react-native-zip-archive';
// NEUER Hook Import
import { useProject } from '../contexts/ProjectContext';

const EAS_TOKEN_KEY = 'eas_token';

const CustomHeader: React.FC<DrawerHeaderProps> = ({ navigation, options }) => {
  const [isTriggeringBuild, setIsTriggeringBuild] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  // === NEUER Context Hook ===
  const { projectData } = useProject(); // Holt das aktuelle Projekt
  // === ENDE ===

  // handleTriggerEasBuild, handleStartExpoGo (unverändert)
  const handleTriggerEasBuild = async () => { /* ... */ console.log("EAS Build Button gedrückt"); setIsTriggeringBuild(true); try { const supabase = await ensureSupabaseClient(); /* @ts-ignore */ if (!supabase || supabase.functions.invoke.toString().includes('DUMMY_CLIENT')) { throw new Error("Supabase Client nicht bereit."); } const easToken = await AsyncStorage.getItem(EAS_TOKEN_KEY); if (!easToken) { Alert.alert( "Fehler: Expo Token fehlt", "Bitte füge deinen Expo Access Token hinzu." ); return; } console.log("Rufe Supabase Function 'trigger-eas-build' auf..."); const { data, error } = await supabase.functions.invoke('trigger-eas-build', { body: JSON.stringify({ easToken: easToken }), }); if (error) { console.error("Fehler von Supabase Function:", error); let detail = error.message || '?'; if (error.context?.details) { try { const p = JSON.parse(error.context.details); detail = p.error || detail; } catch(e) {} } throw new Error(`Fehler beim Starten des Builds: ${detail}`); } console.log("Supabase Function erfolgreich:", data); Alert.alert( "Build Gestartet", data?.message || "Build ausgelöst." ); } catch (err: any) { console.error("Fehler in handleTriggerEasBuild:", err); Alert.alert("Build Fehlgeschlagen", err.message || "?"); } finally { setIsTriggeringBuild(false); } };
  const handleStartExpoGo = () => { Alert.alert("Expo Go", "Deaktiviert."); };

  // Export ZIP Handler (angepasst an Single-Project)
  const handleExportZip = async () => {
    console.log("Export ZIP Button gedrückt");
    // === NEUER Context Hook ===
    if (!projectData || !projectData.files || projectData.files.length === 0) { Alert.alert("Export Fehlgeschlagen", "Kein Projekt (keine Dateien) zum Exportieren vorhanden."); return; }
    const projectFiles = projectData.files;
    const projectName = projectData.name.replace(/[\s\/]+/g, '_') || "projekt";
    // === ENDE ===
    setIsExporting(true);
    try {
        const tempDir = FileSystem.cacheDirectory + 'projekt-export/';
        const zipPath = FileSystem.cacheDirectory + `${projectName}.zip`;
        await FileSystem.deleteAsync(tempDir, { idempotent: true }); await FileSystem.deleteAsync(zipPath, { idempotent: true }); await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true }); console.log(`Temporäres Verzeichnis erstellt: ${tempDir}`);
        for (const file of projectFiles) { const filePath = `${tempDir}${file.path}`; const dirName = filePath.substring(0, filePath.lastIndexOf('/')); if (dirName && dirName !== tempDir.slice(0, -1)) { await FileSystem.makeDirectoryAsync(dirName, { intermediates: true }); } await FileSystem.writeAsStringAsync(filePath, file.content, { encoding: FileSystem.EncodingType.UTF8 }); console.log(`Datei geschrieben: ${filePath}`); }
        console.log(`Erstelle ZIP-Archiv: ${zipPath} aus Verzeichnis: ${tempDir}`); const resultPath = await zip(tempDir, zipPath); console.log(`ZIP erfolgreich erstellt unter: ${resultPath}`); const shareableUri = `file://${resultPath}`;
        if (!(await Sharing.isAvailableAsync())) { throw new Error("Teilen ist auf diesem Gerät nicht verfügbar."); }
        console.log(`Teile Datei: ${shareableUri}`); await Sharing.shareAsync(shareableUri, { mimeType: 'application/zip', dialogTitle: `Projekt '${projectData.name}' exportieren`, UTI: 'com.pkware.zip-archive', }); console.log("Teilen-Dialog für ZIP geöffnet.");
        await FileSystem.deleteAsync(tempDir, { idempotent: true });
    } catch (error: any) { console.error("Fehler beim ZIP-Export:", error); Alert.alert("Export Fehlgeschlagen", error.message || "Ein unbekannter Fehler ist aufgetreten."); }
    finally { setIsExporting(false); }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton} disabled={isTriggeringBuild || isExporting}>
          <Ionicons name="menu-outline" size={30} color={theme.palette.text.primary} />
        </TouchableOpacity>
        {/* === NEUER Context Hook === */}
        <Text style={styles.title} numberOfLines={1}>
          {/* Zeige Namen aus projectData, fallback auf options.title */}
          {projectData?.name ? projectData.name : (options.title || 'k1w1-a0style')} 
        </Text>
        {/* === ENDE === */}
        <View style={styles.iconsContainer}>
          <TouchableOpacity onPress={handleTriggerEasBuild} style={styles.iconButton} disabled={isTriggeringBuild || isExporting}> {isTriggeringBuild ? ( <ActivityIndicator size="small" color={theme.palette.primary} /> ) : ( <Ionicons name="cloud-upload-outline" size={24} color={theme.palette.primary} /> )} </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={handleStartExpoGo} disabled={isTriggeringBuild || isExporting}> <Ionicons name="play-outline" size={24} color={theme.palette.text.secondary} /> </TouchableOpacity>
           <TouchableOpacity style={styles.iconButton} onPress={handleExportZip} disabled={isTriggeringBuild || isExporting}> {isExporting ? ( <ActivityIndicator size="small" color={theme.palette.primary} /> ) : ( <Ionicons name="archive-outline" size={22} color={theme.palette.primary} /> )} </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

// Styles (unverändert)
const styles = StyleSheet.create({
  safeArea: { backgroundColor: theme.palette.card }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.palette.card, paddingHorizontal: 15, height: HEADER_HEIGHT }, title: { position: 'absolute', left: 60, right: 150, textAlign: 'center', color: theme.palette.text.primary, fontSize: 18, fontWeight: 'bold' }, iconsContainer: { flexDirection: 'row', alignItems: 'center' }, menuButton: { padding: 8 }, iconButton: { marginLeft: 12, padding: 8, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
});

export default CustomHeader;

