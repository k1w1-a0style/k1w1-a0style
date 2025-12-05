import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useProject } from '../contexts/ProjectContext';
import * as ImagePicker from 'expo-image-picker';

const TEMPLATE_INFO = {
  name: "Expo SDK 54 Basis",
  version: "1.0.0",
  sdkVersion: "54.0.18",
  rnVersion: "0.81.4",
} as const;

const AppInfoScreen = () => {
  const { projectData, setProjectName, updateProjectFiles, setPackageName } = useProject();
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
      } catch {
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // Korrekt für deine Expo-Version
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
      const iconFile = { path: 'assets/icon.png', content: base64Content };
      const adaptiveIconFile = { path: 'assets/adaptive-icon.png', content: base64Content };

      await updateProjectFiles([iconFile, adaptiveIconFile]);
      
      Alert.alert('✅ Erfolg', 'App-Icon wurde erfolgreich aktualisiert!');
    } catch (error: any) {
      console.error('[AppInfoScreen] Icon Picker Error:', error);
      Alert.alert('Fehler', error?.message || 'Icon konnte nicht aktualisiert werden.');
    }
  }, [updateProjectFiles]);

  const fileCount = useMemo(() => projectData?.files?.length || 0, [projectData?.files]);
  const messageCount = useMemo(
    () => (projectData?.chatHistory || projectData?.messages)?.length || 0,
    [projectData?.chatHistory, projectData?.messages]
  );

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
          <Text style={styles.label}>App Icon:</Text>
          <TouchableOpacity onPress={handleChooseIcon} style={styles.iconButton}>
            {iconPreview ?
            (
              <Image
                source={{ uri: iconPreview }}
                style={styles.iconPreview}
                onError={(error) => {
                  console.log('❌ Bild-Ladefehler:', error.nativeEvent.error);
                  setIconPreview(null);
                }}
              />
            ) : (
              <View style={styles.iconPlaceholder}>
                <Ionicons name="image-outline" size={24} color={theme.palette.text.secondary} />
              </View>
            )}
            <Text style={styles.iconButtonText}>
              {iconPreview ? 'App Icon ändern...' : 'App Icon auswählen...'}
            </Text>
          </TouchableOpacity>
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
});

export default AppInfoScreen;

