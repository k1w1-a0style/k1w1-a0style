// components/CustomHeader.tsx (v7.1 - Debug)
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, HEADER_HEIGHT } from '../theme';
import { DrawerHeaderProps } from '@react-navigation/drawer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureSupabaseClient } from '../lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { zip } from 'react-native-zip-archive';
import { useProject } from '../contexts/ProjectContext';
import { SupabaseClient } from '@supabase/supabase-js';

const EAS_TOKEN_KEY = 'eas_token';
const GITHUB_REPO_KEY = 'github_repo_key';
const GITHUB_TOKEN_KEY = 'github_token';

let pollingInterval: NodeJS.Timeout | null = null;

const CustomHeader: React.FC<DrawerHeaderProps> = ({ navigation, options }) => {
  const [isTriggeringBuild, setIsTriggeringBuild] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { projectData } = useProject();

  const [isPolling, setIsPolling] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<number | null>(null);
  const [buildStatus, setBuildStatus] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const supabaseRef = useRef<SupabaseClient | null>(null);
  const easTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (isPolling && currentJobId) {
      console.log(`POLLING GESTARTET für Job ${currentJobId}`);
      setBuildStatus('Wartet auf GitHub...');

      const poll = async () => {
        if (!supabaseRef.current || !easTokenRef.current || !currentJobId) {
          console.warn('Polling gestoppt: Refs fehlen.');
          setIsPolling(false); setBuildStatus('Polling-Fehler'); return;
        }
        try {
          const { data, error } = await supabaseRef.current.functions.invoke('check-eas-build', {
            body: { jobId: currentJobId, easToken: easTokenRef.current }
          });
          if (error) throw error;
          console.log('Poll Status:', data.status);
          switch (data.status) {
            case 'pending': setBuildStatus('Job erstellt...'); break;
            case 'pushed': setBuildStatus('Code gepusht...'); break;
            case 'building': setBuildStatus('Build läuft...'); break;
            case 'success':
              setBuildStatus('Build erfolgreich!');
              setDownloadUrl(data.download_url || null);
              setIsPolling(false); setCurrentJobId(null); break;
            case 'error':
              setBuildStatus('Build fehlgeschlagen!');
              setIsPolling(false); setCurrentJobId(null); break;
          }
        } catch (pollError: any) {
          console.error('Polling-Fehler:', pollError);
          setBuildStatus('Polling-Fehler');
          setIsPolling(false); setCurrentJobId(null);
        }
      };
      poll();
      pollingInterval = setInterval(poll, 15000);
    } else if (!isPolling && pollingInterval) {
      console.log('POLLING GESTOPPT.');
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    return () => {
      if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
    };
  }, [isPolling, currentJobId]);

  const handleTriggerEasBuild = async () => {
    console.log("EAS Build Button gedrückt (v7.1 - Debug)");
    setIsTriggeringBuild(true);
    setBuildStatus('Code wird vorbereitet...');
    setDownloadUrl(null);

    try {
      if (!projectData || !projectData.files || projectData.files.length === 0) {
        throw new Error("Projekt ist leer. Es gibt keine Dateien zum Bauen.");
      }
      const supabase = await ensureSupabaseClient();
      supabaseRef.current = supabase;
      /* @ts-ignore */
      if (!supabase || supabase.functions.invoke.toString().includes('DUMMY_CLIENT')) {
        throw new Error("Supabase Client nicht bereit. Bitte in 'Verbindungen' prüfen.");
      }
      
      const easToken = await AsyncStorage.getItem(EAS_TOKEN_KEY);
      const GITHUB_REPO = await AsyncStorage.getItem(GITHUB_REPO_KEY);
      const GITHUB_TOKEN = await AsyncStorage.getItem(GITHUB_TOKEN_KEY);

      // 🔍 DEBUG: Zeige Token-Previews
      console.log('🔍 DEBUG App: easToken:', easToken ? easToken.substring(0, 10) + '...' : '❌ FEHLT');
      console.log('🔍 DEBUG App: GITHUB_TOKEN:', GITHUB_TOKEN ? GITHUB_TOKEN.substring(0, 10) + '...' : '❌ FEHLT');
      console.log('🔍 DEBUG App: GITHUB_REPO:', GITHUB_REPO || '❌ FEHLT');

      easTokenRef.current = easToken;
      if (!easToken || !GITHUB_REPO || !GITHUB_TOKEN) {
        throw new Error("Expo Token, GitHub Token oder GitHub Repo fehlt. Bitte 'Verbindungen' prüfen.");
      }

      console.log(`(v7.1) Pushe ${projectData.files.length} Dateien nach ${GITHUB_REPO}...`);

      const { data, error } = await supabase.functions.invoke('trigger-eas-build', {
        body: {
          githubRepo: GITHUB_REPO,
          githubToken: GITHUB_TOKEN,
          files: projectData.files
        }
      });

      if (error) {
        console.error("Fehler von Supabase Function:", error);
        let detail = error.message || '?';
        if (error.context?.details) {
          try {
            const p = JSON.parse(error.context.details);
            detail = p.error || detail;
            console.error("Server-Fehlerdetails:", detail);
          } catch (e) { }
        }
        throw new Error(`Fehler beim Starten des Builds: ${detail}`);
      }

      console.log("Supabase Function (v7.1) erfolgreich:", data);

      setCurrentJobId(data.job_id);
      setIsPolling(true);
      setBuildStatus('Code gepusht. Warte auf Build...');

    } catch (err: any) {
      console.error("Fehler in handleTriggerEasBuild:", err);
      Alert.alert("Build Fehlgeschlagen", err.message || "?");
      setBuildStatus(null);
    } finally {
      setIsTriggeringBuild(false);
    }
  };

  const handleDownloadBuild = () => {
    if (downloadUrl) {
      Alert.alert(
        "Build herunterladen",
        "Möchtest du die fertige APK im Browser öffnen?",
        [
          { text: "Abbrechen", style: "cancel" },
          { text: "Öffnen", onPress: () => Linking.openURL(downloadUrl) }
        ]
      );
    }
  };

  const handleStartExpoGo = () => { Alert.alert("Expo Go", "Deaktiviert."); };

  const handleExportZip = async () => {
    console.log("Export ZIP Button gedrückt");
    if (!projectData || !projectData.files || projectData.files.length === 0) {
      Alert.alert("Export Fehlgeschlagen", "Kein Projekt (keine Dateien) zum Exportieren vorhanden.");
      return;
    }
    const projectFiles = projectData.files;
    const projectName = projectData.name.replace(/[\s\/]+/g, '_') || "projekt";
    setIsExporting(true);
    try {
      const tempDir = FileSystem.cacheDirectory + 'projekt-export/';
      const zipPath = FileSystem.cacheDirectory + `${projectName}.zip`;
      await FileSystem.deleteAsync(tempDir, { idempotent: true });
      await FileSystem.deleteAsync(zipPath, { idempotent: true });
      await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
      for (const file of projectFiles) {
        const contentString = typeof file.content === 'string' ? file.content : JSON.stringify(file.content, null, 2);
        const filePath = `${tempDir}${file.path}`;
        const dirName = filePath.substring(0, filePath.lastIndexOf('/'));
        if (dirName && dirName !== tempDir.slice(0, -1)) {
          await FileSystem.makeDirectoryAsync(dirName, { intermediates: true });
        }
        await FileSystem.writeAsStringAsync(filePath, contentString, {
          encoding: FileSystem.EncodingType.UTF8
        });
      }
      const resultPath = await zip(tempDir, zipPath);
      const shareableUri = `file://${resultPath}`;
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("Teilen ist auf diesem Gerät nicht verfügbar.");
      }
      await Sharing.shareAsync(shareableUri, {
        mimeType: 'application/zip',
        dialogTitle: `Projekt '${projectData.name}' exportieren`,
        UTI: 'com.pkware.zip-archive'
      });
      await FileSystem.deleteAsync(tempDir, { idempotent: true });
    } catch (error: any) {
      console.error("Fehler beim ZIP-Export:", error);
      Alert.alert("Export Fehlgeschlagen", error.message || "Ein unbekannter Fehler ist aufgetreten.");
    } finally {
      setIsExporting(false);
    }
  };

  const headerTitle = String(projectData?.name || options?.title || 'k1w1-a0style');
  const isLoading = isTriggeringBuild || isPolling;

  const renderBuildIcon = () => {
    if (isLoading) {
      return <ActivityIndicator size="small" color={theme.palette.primary} />;
    }
    if (downloadUrl) {
      return <Ionicons name="cloud-download-outline" size={24} color={theme.palette.success} />;
    }
    return <Ionicons name="cloud-upload-outline" size={24} color={theme.palette.primary} />;
  };

  const onBuildIconPress = () => {
    if (isLoading) return;
    if (downloadUrl) {
      handleDownloadBuild();
    } else {
      handleTriggerEasBuild();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton} disabled={isLoading || isExporting}>
          <Ionicons name="menu-outline" size={30} color={theme.palette.text.primary} />
        </TouchableOpacity>
        {buildStatus ? (
          <Text style={[styles.title, styles.statusTitle]} numberOfLines={1}>
            {buildStatus}
          </Text>
        ) : (
          <Text style={styles.title} numberOfLines={1}>
            {headerTitle}
          </Text>
        )}
        <View style={styles.iconsContainer}>
          <TouchableOpacity onPress={onBuildIconPress} style={styles.iconButton} disabled={isExporting}>
            {renderBuildIcon()}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={handleStartExpoGo} disabled={isLoading || isExporting}>
            <Ionicons name="play-outline" size={24} color={theme.palette.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={handleExportZip} disabled={isLoading || isExporting}>
            {isExporting ? <ActivityIndicator size="small" color={theme.palette.primary} /> : <Ionicons name="archive-outline" size={22} color={theme.palette.primary} />}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { backgroundColor: theme.palette.card },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.palette.card, paddingHorizontal: 15, height: HEADER_HEIGHT },
  title: { position: 'absolute', left: 60, right: 150, textAlign: 'center', color: theme.palette.text.primary, fontSize: 18, fontWeight: 'bold' },
  statusTitle: { fontSize: 14, color: theme.palette.text.secondary, fontStyle: 'italic' },
  iconsContainer: { flexDirection: 'row', alignItems: 'center' },
  menuButton: { padding: 8 },
  iconButton: { marginLeft: 12, padding: 8, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
});

export default CustomHeader;
