import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useProject } from '../contexts/ProjectContext';
import { useAI, PROVIDER_METADATA, type AllAIProviders } from '../contexts/AIContext';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const TEMPLATE_INFO = {
  name: "Expo SDK 54 Basis",
  version: "1.0.0",
  sdkVersion: "54.0.18",
  rnVersion: "0.81.4",
} as const;

// Export/Import für API Config
const exportAPIConfig = async (config: any) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `k1w1-api-backup-${timestamp}.json`;
    const filePath = FileSystem.cacheDirectory + fileName;
    
    const exportData = {
      version: 1,
      exportDate: new Date().toISOString(),
      appVersion: TEMPLATE_INFO.version,
      config: config,
    };
    
    await FileSystem.writeAsStringAsync(
      filePath,
      JSON.stringify(exportData, null, 2),
      { encoding: FileSystem.EncodingType.UTF8 }
    );
    
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('Teilen ist auf diesem Gerät nicht verfügbar.');
    }
    
    await Sharing.shareAsync(`file://${filePath}`, {
      mimeType: 'application/json',
      dialogTitle: 'API-Konfiguration exportieren',
      UTI: 'public.json',
    });
    
    return { success: true, fileName };
    } catch (error: any) {
      throw new Error(error?.message || 'Export fehlgeschlagen');
    }
};

const importAPIConfig = async () => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });
    
    if (result.canceled || !result.assets?.[0]?.uri) {
      throw new Error('Import abgebrochen');
    }
    
    const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    
    const importData = JSON.parse(fileContent);
    
    if (!importData.config || !importData.version) {
      throw new Error('Ungültiges Backup-Format');
    }
    
    return { success: true, config: importData.config, exportDate: importData.exportDate };
    } catch (error: any) {
      if (error.message.includes('abgebrochen')) {
        throw error;
      }
      throw new Error(error?.message || 'Import fehlgeschlagen');
    }
};

const AppInfoScreen = () => {
  const { projectData, setProjectName, updateProjectFiles, setPackageName } = useProject();
  const { config, addApiKey } = useAI();
  const [appName, setAppName] = useState('');
  const [packageName, setPackageNameState] = useState('');
  const [iconPreview, setIconPreview] = useState<string | null>(null);

  // Load app name and package name from project
  useEffect(() => {
    if (!projectData?.files) return;
    
    setAppName(projectData.name || 'Meine App');

    const pkgJson = projectData.files.find(f => f.path === 'package.json');
    if (pkgJson && typeof pkgJson.content === 'string') {
      try {
        const parsed = JSON.parse(pkgJson.content);
        setPackageNameState(parsed.name || 'meine-app');
      } catch (error) {
        // Silently fallback to default
        setPackageNameState('meine-app');
      }
    }
  }, [projectData?.name, projectData?.files]);

  // Load icon preview separately to avoid unnecessary re-renders
  useEffect(() => {
    if (!projectData?.files) {
      setIconPreview(null);
      return;
    }

    const iconFile = projectData.files.find(f => f.path === 'assets/icon.png');
    if (!iconFile?.content) {
      setIconPreview(null);
      return;
    }

    let base64Data = iconFile.content;
    if (base64Data.startsWith('data:image/')) {
      base64Data = base64Data.split(',')[1];
    }
    
    if (base64Data && base64Data.length > 100 && /^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
      setIconPreview(`data:image/png;base64,${base64Data}`);
    } else {
      setIconPreview(null);
    }
  }, [projectData?.files, projectData?.lastModified]);

  const handleSaveAppName = useCallback(async () => {
    const trimmedName = appName.trim();
    if (!trimmedName) {
      Alert.alert('Fehler', 'App-Name darf nicht leer sein.');
      return;
    }
    
    try {
      await setProjectName(trimmedName);
      Alert.alert('✅ Gespeichert', `App-Name: "${trimmedName}"`);
    } catch (error: any) {
      Alert.alert('Fehler', error?.message || 'Konnte App-Name nicht speichern.');
    }
  }, [appName, setProjectName]);

  const handleSavePackageName = useCallback(async () => {
    const trimmedPkg = packageName.trim();
    if (!trimmedPkg) {
      Alert.alert('Fehler', 'Package Name darf nicht leer sein.');
      return;
    }
    
    try {
      await setPackageName(trimmedPkg);
      Alert.alert('✅ Gespeichert', `Package Name: "${trimmedPkg}"`);
    } catch (error: any) {
      Alert.alert('Fehler', error?.message || 'Konnte Package Name nicht speichern.');
    }
  }, [packageName, setPackageName]);

  const handleChooseIcon = useCallback(async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert('Fehler', 'Zugriff auf die Fotogalerie wurde verweigert.');
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (pickerResult.canceled) {
        return;
      }

      const asset = pickerResult.assets?.[0];
      if (!asset || !asset.base64) {
        Alert.alert('Fehler', 'Konnte das Bild nicht als Base64 laden.');
        return;
      }
      
      const base64Content = asset.base64;
      
      // Setze alle notwendigen Asset-Dateien für den App-Build
      const iconFile = { path: 'assets/icon.png', content: base64Content };
      const adaptiveIconFile = { path: 'assets/adaptive-icon.png', content: base64Content };
      const splashFile = { path: 'assets/splash.png', content: base64Content };
      const faviconFile = { path: 'assets/favicon.png', content: base64Content };

      await updateProjectFiles([iconFile, adaptiveIconFile, splashFile, faviconFile]);
      
      Alert.alert(
        '✅ Erfolg', 
        'Alle App-Assets wurden aktualisiert:\n\n• icon.png\n• adaptive-icon.png\n• splash.png\n• favicon.png\n\nDeine App ist bereit für den Build!'
      );
    } catch (error: any) {
      Alert.alert('Fehler', error?.message || 'Assets konnten nicht aktualisiert werden.');
    }
  }, [updateProjectFiles]);

  const handleExportAPIConfig = useCallback(async () => {
    try {
      const result = await exportAPIConfig(config);
      Alert.alert(
        '✅ Export erfolgreich',
        `API-Konfiguration wurde als Datei "${result.fileName}" gespeichert und kann nun geteilt werden.`
      );
    } catch (error: any) {
      Alert.alert('Fehler beim Export', error?.message || 'Export fehlgeschlagen');
    }
  }, [config]);

  const handleImportAPIConfig = useCallback(async () => {
    Alert.alert(
      '⚠️ API-Konfiguration importieren',
      'Dies wird alle vorhandenen API-Keys durch die importierten ersetzen. Fortfahren?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Importieren',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await importAPIConfig();
              
              // Importiere alle Keys
              const importedConfig = result.config;
              const providers: AllAIProviders[] = ['groq', 'gemini', 'openai', 'anthropic', 'huggingface'];
              
              let totalKeysImported = 0;
              for (const provider of providers) {
                const keys = importedConfig.apiKeys?.[provider] || [];
                for (const key of keys) {
                  try {
                    await addApiKey(provider, key);
                    totalKeysImported++;
                  } catch (e) {
                    // Key existiert bereits, überspringen
                  }
                }
              }
              
              const exportDate = result.exportDate 
                ? new Date(result.exportDate).toLocaleString('de-DE')
                : 'Unbekannt';
              
              Alert.alert(
                '✅ Import erfolgreich',
                `${totalKeysImported} API-Keys wurden importiert.\n\nBackup-Datum: ${exportDate}\n\nBitte überprüfe die geladenen Keys in der Liste unten.`
              );
            } catch (error: any) {
              if (!error.message.includes('abgebrochen')) {
                Alert.alert('Fehler beim Import', error?.message || 'Import fehlgeschlagen');
              }
            }
          },
        },
      ]
    );
  }, [addApiKey]);

  const fileCount = useMemo(() => projectData?.files?.length || 0, [projectData?.files]);
  const messageCount = useMemo(
    () => (projectData?.chatHistory || projectData?.messages)?.length || 0,
    [projectData?.chatHistory, projectData?.messages]
  );
  
  // API Keys für jede Provider zählen
  const apiKeysCount = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.keys(config.apiKeys).forEach((provider) => {
      counts[provider] = (config.apiKeys[provider as AllAIProviders] || []).length;
    });
    return counts;
  }, [config.apiKeys]);
  
  // Prüfe, welche Assets gesetzt sind
  const assetsStatus = useMemo(() => {
    if (!projectData?.files) return { icon: false, adaptiveIcon: false, splash: false, favicon: false };
    
    const hasIcon = projectData.files.some(f => f.path === 'assets/icon.png' && f.content.length > 100);
    const hasAdaptiveIcon = projectData.files.some(f => f.path === 'assets/adaptive-icon.png' && f.content.length > 100);
    const hasSplash = projectData.files.some(f => f.path === 'assets/splash.png' && f.content.length > 100);
    const hasFavicon = projectData.files.some(f => f.path === 'assets/favicon.png' && f.content.length > 100);
    
    return { icon: hasIcon, adaptiveIcon: hasAdaptiveIcon, splash: hasSplash, favicon: hasFavicon };
  }, [projectData?.files]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>

        {/* APP SETTINGS */}
        <Text style={styles.sectionTitle}>📱 App-Einstellungen</Text>

        <View style={styles.settingsContainer}>
          <Text style={styles.label}>App Name:</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={appName}
              onChangeText={setAppName}
              placeholder="Meine App"
              placeholderTextColor={theme.palette.text.secondary}
            />
            <TouchableOpacity onPress={handleSaveAppName} style={styles.saveButton}>
              <Ionicons name="checkmark" size={24} color={theme.palette.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.settingsContainer}>
          <Text style={styles.label}>Package Name (Slug):</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={packageName}
              onChangeText={setPackageNameState}
              placeholder="meine-app"
              placeholderTextColor={theme.palette.text.secondary}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={handleSavePackageName} style={styles.saveButton}>
              <Ionicons name="checkmark" size={24} color={theme.palette.primary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>Ändert package.json (name) und app.config.js (slug, package, bundleIdentifier)</Text>
        </View>

        <View style={styles.settingsContainer}>
          <Text style={styles.label}>App Icon & Assets:</Text>
          <TouchableOpacity onPress={handleChooseIcon} style={styles.iconButton}>
            {iconPreview ?
            (
              <Image
                source={{ uri: iconPreview }}
                style={styles.iconPreview}
                onError={() => {
                  setIconPreview(null);
                }}
              />
            ) : (
              <View style={styles.iconPlaceholder}>
                <Ionicons name="image-outline" size={24} color={theme.palette.text.secondary} />
              </View>
            )}
            <Text style={styles.iconButtonText}>
              {iconPreview ? 'App Assets ändern...' : 'App Assets auswählen...'}
            </Text>
          </TouchableOpacity>
          
          {/* Assets Status */}
          <View style={styles.assetsStatus}>
            <Text style={styles.assetsStatusTitle}>Gesetzte Assets:</Text>
            <View style={styles.assetsStatusList}>
              <View style={styles.assetStatusItem}>
                <Ionicons 
                  name={assetsStatus.icon ? 'checkmark-circle' : 'close-circle'} 
                  size={16} 
                  color={assetsStatus.icon ? theme.palette.success : theme.palette.error} 
                />
                <Text style={styles.assetStatusText}>icon.png</Text>
              </View>
              <View style={styles.assetStatusItem}>
                <Ionicons 
                  name={assetsStatus.adaptiveIcon ? 'checkmark-circle' : 'close-circle'} 
                  size={16} 
                  color={assetsStatus.adaptiveIcon ? theme.palette.success : theme.palette.error} 
                />
                <Text style={styles.assetStatusText}>adaptive-icon.png</Text>
              </View>
              <View style={styles.assetStatusItem}>
                <Ionicons 
                  name={assetsStatus.splash ? 'checkmark-circle' : 'close-circle'} 
                  size={16} 
                  color={assetsStatus.splash ? theme.palette.success : theme.palette.error} 
                />
                <Text style={styles.assetStatusText}>splash.png</Text>
              </View>
              <View style={styles.assetStatusItem}>
                <Ionicons 
                  name={assetsStatus.favicon ? 'checkmark-circle' : 'close-circle'} 
                  size={16} 
                  color={assetsStatus.favicon ? theme.palette.success : theme.palette.error} 
                />
                <Text style={styles.assetStatusText}>favicon.png</Text>
              </View>
            </View>
          </View>
        </View>

        {/* API BACKUP & RESTORE */}
        <Text style={styles.sectionTitle}>💾 API-Backup & Wiederherstellung</Text>
        <View style={styles.apiBackupContainer}>
          <Text style={styles.apiBackupDescription}>
            Exportiere oder importiere alle API-Keys und Einstellungen als Datei.
          </Text>
          
          <View style={styles.apiBackupButtons}>
            <TouchableOpacity onPress={handleExportAPIConfig} style={styles.backupButton}>
              <Ionicons name="download-outline" size={20} color={theme.palette.primary} />
              <Text style={styles.backupButtonText}>Exportieren</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={handleImportAPIConfig} style={[styles.backupButton, styles.restoreButton]}>
              <Ionicons name="cloud-upload-outline" size={20} color={theme.palette.warning} />
              <Text style={[styles.backupButtonText, styles.restoreButtonText]}>Importieren</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* AKTIVE API KEYS */}
        <Text style={styles.sectionTitle}>🔑 Aktive API-Keys</Text>
        <View style={styles.apiKeysContainer}>
          <Text style={styles.apiKeysDescription}>
            Alle aktuell integrierten und aktiven API-Keys (der erste Key wird verwendet):
          </Text>
          
          {(['groq', 'gemini', 'openai', 'anthropic', 'huggingface'] as AllAIProviders[]).map((provider) => {
            const keys = config.apiKeys[provider] || [];
            const metadata = PROVIDER_METADATA[provider];
            
            return (
              <View key={provider} style={styles.providerKeySection}>
                <View style={styles.providerHeader}>
                  <Text style={styles.providerEmoji}>{metadata.emoji}</Text>
                  <Text style={styles.providerName}>{metadata.label}</Text>
                  <View style={styles.keyCountBadge}>
                    <Text style={styles.keyCountText}>{keys.length}</Text>
                  </View>
                </View>
                
                {keys.length === 0 ? (
                  <Text style={styles.noKeysText}>Keine Keys konfiguriert</Text>
                ) : (
                  <View style={styles.keysList}>
                    {keys.map((key, index) => (
                      <View key={index} style={styles.keyItem}>
                        <View style={styles.keyItemHeader}>
                          <Text style={styles.keyIndexLabel}>
                            {index === 0 ? '🟢 Aktiv' : `#${index + 1}`}
                          </Text>
                        </View>
                        <Text style={styles.keyText} numberOfLines={1}>
                          {key}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* TEMPLATE-INFO */}
        <Text style={styles.sectionTitle}>📦 Projekt-Template</Text>
        <View style={styles.templateInfoContainer}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Template:</Text>
            <Text style={styles.infoValue}>{TEMPLATE_INFO.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Expo SDK:</Text>
            <Text style={styles.infoValue}>{TEMPLATE_INFO.sdkVersion}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>React Native:</Text>
            <Text style={styles.infoValue}>{TEMPLATE_INFO.rnVersion}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Standard-Dateien:</Text>
            <Text style={styles.infoValue}>{fileCount}</Text>
          </View>
          <Text style={styles.infoHint}>
            ℹ️ Neue Projekte starten automatisch mit diesem Template.
          </Text>
        </View>

        {/* PROJEKT-INFO */}
        <Text style={styles.sectionTitle}>ℹ️ Aktuelles Projekt</Text>
        <View style={styles.projectInfoContainer}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Projekt-ID:</Text>
            <Text style={styles.infoValueMono} numberOfLines={1}>
              {projectData?.id ? projectData.id.substring(0, 13) + '...' : 'N/A'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Dateien:</Text>
            <Text style={styles.infoValue}>{fileCount}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nachrichten:</Text>
            <Text style={styles.infoValue}>{messageCount}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Letzte Änderung:</Text>
            <Text style={styles.infoValueMono} numberOfLines={1}>
              {projectData?.lastModified
                ? new Date(projectData.lastModified).toLocaleString('de-DE')
                : 'N/A'}
            </Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

// Styles (Deine neuen Styles aus der .docx)
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.palette.background },
  container: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.palette.text.primary,
    marginTop: 20,
    marginBottom: 12
  },
  settingsContainer: { marginBottom: 16 },
  label: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    marginBottom: 8
  },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: theme.palette.input.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    color: theme.palette.text.primary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: theme.palette.border
  },
  saveButton: { padding: 8, marginLeft: 10 },
  hint: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 5,
    fontStyle: 'italic'
  },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.palette.card,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border
  },
  iconButtonText: {
    marginLeft: 12,
    fontSize: 14,
    color: theme.palette.text.secondary
  },
  iconPreview: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  iconPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assetsStatus: {
    marginTop: 12,
    padding: 12,
    backgroundColor: theme.palette.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  assetsStatusTitle: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginBottom: 8,
    fontWeight: '600',
  },
  assetsStatusList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  assetStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: theme.palette.card,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  assetStatusText: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  templateInfoContainer: {
    backgroundColor: theme.palette.card,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginBottom: 8
  },
  projectInfoContainer: {
    backgroundColor: theme.palette.card,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.palette.border
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border
  },
  infoLabel: { fontSize: 14, color: theme.palette.text.secondary },
  infoValue: { fontSize: 14, fontWeight: 'bold', color: theme.palette.primary },
  infoValueMono: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: theme.palette.primary,
    maxWidth: '60%'
  },
  infoHint: {
    fontSize: 12,
    color: theme.palette.text.disabled,
    marginTop: 10,
    fontStyle: 'italic'
  },
  
  // API Backup Styles
  apiBackupContainer: {
    backgroundColor: theme.palette.card,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginBottom: 8,
  },
  apiBackupDescription: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    marginBottom: 16,
  },
  apiBackupButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  backupButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.palette.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  restoreButton: {
    borderColor: theme.palette.warning,
  },
  backupButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.palette.primary,
  },
  restoreButtonText: {
    color: theme.palette.warning,
  },
  
  // API Keys Display Styles
  apiKeysContainer: {
    backgroundColor: theme.palette.card,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginBottom: 8,
  },
  apiKeysDescription: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  providerKeySection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  providerEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  providerName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.palette.text.primary,
    flex: 1,
  },
  keyCountBadge: {
    backgroundColor: theme.palette.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  keyCountText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.palette.background,
  },
  noKeysText: {
    fontSize: 13,
    color: theme.palette.text.disabled,
    fontStyle: 'italic',
    paddingLeft: 28,
  },
  keysList: {
    paddingLeft: 28,
  },
  keyItem: {
    marginBottom: 8,
    backgroundColor: theme.palette.background,
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  keyItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  keyIndexLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.palette.primary,
    textTransform: 'uppercase',
  },
  keyText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: theme.palette.text.secondary,
    lineHeight: 16,
  },
});

export default AppInfoScreen;

