// components/CustomHeader.tsx (v8.0 - Variante A Serverless Build)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, HEADER_HEIGHT } from '../theme';
import { DrawerHeaderProps } from '@react-navigation/drawer';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { zip } from 'react-native-zip-archive';
import { useProject } from '../contexts/ProjectContext';

let pollingInterval: NodeJS.Timeout | null = null;
const POLLING_INTERVAL_MS = 15000; // 15 Sekunden

const CustomHeader: React.FC<DrawerHeaderProps> = ({ navigation, options }) => {
  const [isTriggeringBuild, setIsTriggeringBuild] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // NEU: ProjectContext verwenden (holt die serverlosen Funktionen)
  const { projectData, exportAndBuild, getWorkflowRuns } = useProject();

  const [isPolling, setIsPolling] = useState(false);
  // NEU: Speichere das Repo, das gepollt wird
  const [pollingRepo, setPollingRepo] = useState<{ owner: string, repo: string } | null>(null);
  const [buildStatus, setBuildStatus] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // NEU: Polling-Logik für GitHub Actions (Variante A)
  const pollGitHubActions = useCallback(async () => {
    if (!pollingRepo) {
      console.log('Polling gestoppt: Kein Repo ausgewählt.');
      setIsPolling(false);
      return;
    }
    
    const WORKFLOW_FILE_NAME = 'eas-build.yml'; 
    try {
      console.log(`Polling GitHub Actions für ${pollingRepo.owner}/${pollingRepo.repo}...`);
      const data = await getWorkflowRuns(pollingRepo.owner, pollingRepo.repo, WORKFLOW_FILE_NAME);
      
      if (!data.workflow_runs || data.workflow_runs.length === 0) {
        setBuildStatus('Wartet auf GitHub...');
        return;
      }
      
      const latestRun = data.workflow_runs[0];
      
      switch (latestRun.status) {
        case 'queued':
          setBuildStatus('Build in Warteschlange...');
          break;
        case 'in_progress':
          setBuildStatus('Build läuft...');
          break;
        case 'completed':
          setIsPolling(false); 
          setPollingRepo(null);
          
          if (latestRun.conclusion === 'success') {
            setBuildStatus('Build erfolgreich!');
            const runUrl = latestRun.html_url;
            setDownloadUrl(runUrl);
            Alert.alert(
              'Build Abgeschlossen', 
              'Build erfolgreich. Klicke auf den Download-Button, um das Artefakt (die .apk) anzusehen.'
            );
          } else {
            setBuildStatus(`Build fehlgeschlagen (${latestRun.conclusion})`);
            Alert.alert('Build Fehlgeschlagen', `Der GitHub Actions Run ist mit Status '${latestRun.conclusion}' fehlgeschlagen.`);
          }
          break;
        default:
          setBuildStatus(`Status: ${latestRun.status}`);
      }
      
    } catch (pollError: any) {
      console.error('GitHub Polling-Fehler:', pollError);
      setBuildStatus('Polling-Fehler');
      setIsPolling(false);
      setPollingRepo(null);
    }
  }, [pollingRepo, getWorkflowRuns]);

  // NEU: useEffect für GitHub Actions Polling
  useEffect(() => {
    if (isPolling && pollingRepo) {
      console.log(`POLLING GESTARTET für ${pollingRepo.owner}/${pollingRepo.repo}`);
      pollGitHubActions(); 
      pollingInterval = setInterval(pollGitHubActions, POLLING_INTERVAL_MS);
    } else if (!isPolling && pollingInterval) {
      console.log('POLLING GESTOPPT.');
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    };
  }, [isPolling, pollingRepo, pollGitHubActions]);

  // NEU: handleTriggerEasBuild (Variante A)
  const handleTriggerEasBuild = async () => {
    console.log("EAS Build Button gedrückt (Variante A - Serverless)");
    if (!projectData) {
        Alert.alert("Fehler", "Kein Projekt geladen.");
        return;
    }

    setIsTriggeringBuild(true);
    setBuildStatus('Starte Repo-Erstellung...');
    setDownloadUrl(null); // Alten Download-Link löschen

    try {
      // Rufe die Context-Funktion auf (diese enthält jetzt den Check für die YML)
      const repoInfo = await exportAndBuild(projectData);
      
      if (repoInfo) {
        // Starte das Polling für das neu erstellte Repo
        setPollingRepo(repoInfo);
        setIsPolling(true);
        setBuildStatus('Wartet auf GitHub...');
      } else {
        // Fehler wurde bereits im Context per Alert angezeigt
        setBuildStatus(null);
      }
    } catch (err: any) {
      // Fehler wurde bereits im Context per Alert angezeigt
      console.error("Fehler in handleTriggerEasBuild (Variante A):", err);
      setBuildStatus(null);
    } finally {
      setIsTriggeringBuild(false);
    }
  };

  const handleDownloadBuild = () => {
    if (downloadUrl) {
      Alert.alert(
        "Build herunterladen",
        "Möchtest du die GitHub Actions Seite im Browser öffnen, um das Artefakt (die .apk) herunterzuladen?",
        [
          { text: "Abbrechen", style: "cancel" },
          { text: "Öffnen", onPress: () => Linking.openURL(downloadUrl) }
        ]
      );
    }
  };

  const handleStartExpoGo = () => { Alert.alert("Expo Go", "Deaktiviert."); };

  // ZIP Export (Keine Änderung)
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
        const contentString = typeof file.content === 'string' ?
          file.content :
          JSON.stringify(file.content, null, 2);
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

