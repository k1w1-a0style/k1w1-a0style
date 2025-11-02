import React, { useState, useEffect } from 'react';
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
  files: 5
};

const AppInfoScreen = () => {
  const { projectData, setProjectName, updateProjectFiles, setPackageName } = useProject();
  const [appName, setAppName] = useState('');
  const [packageName, setPackageNameState] = useState('');
  const [iconPreview, setIconPreview] = useState<string | null>(null);

  useEffect(() => {
    if (projectData && projectData.files) { 
      setAppName(projectData.name || 'Meine App');

      const pkgJson = projectData.files.find(f => f.path === 'package.json');
      if (pkgJson && typeof pkgJson.content === 'string') {
        try {
          const parsed = JSON.parse(pkgJson.content);
          setPackageNameState(parsed.name || 'meine-app');
        } catch (e) {
          setPackageNameState('meine-app');
        }
      }

      const iconFile = projectData.files.find(f => f.path === 'assets/icon.png');
      if (iconFile && iconFile.content) {
        if (iconFile.content.length > 100 && !iconFile.content.includes('{') && !iconFile.content.startsWith('data:')) {
           setIconPreview(`data:image/png;base64,${iconFile.content}`);
        } else if (iconFile.content.startsWith('data:image/png;base64,')) {
           setIconPreview(iconFile.content);
        } else {
           setIconPreview(null);
        }
      } else {
        setIconPreview(null);
      }
    }
  // === KORREKTUR HIER ===
  // Höre auf 'files' und 'lastModified', nicht nur auf das 'projectData'-Objekt.
  }, [projectData?.files, projectData?.lastModified, projectData?.name]);

  const handleSaveAppName = async () => {
    if (appName.trim()) {
      await setProjectName(appName.trim());
      Alert.alert('Gespeichert', `App-Name: "${appName.trim()}"`);
    }
  };

  const handleSavePackageName = async () => {
    if (!packageName.trim()) {
      Alert.alert('Fehler', 'Package Name darf nicht leer sein.');
      return;
    }
    await setPackageName(packageName.trim());
  };

  const handleChooseIcon = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Fehler', 'Zugriff auf die Fotogalerie wurde verweigert.');
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (pickerResult.canceled) {
      return;
    }

    const base64Content = pickerResult.assets[0].base64;
    if (base64Content) {
      const iconFile = { path: 'assets/icon.png', content: base64Content };
      const adaptiveIconFile = { path: 'assets/adaptive-icon.png', content: base64Content };

      await updateProjectFiles([iconFile, adaptiveIconFile]);

      // (Aktualisierung passiert jetzt automatisch durch das korrigierte useEffect)
      Alert.alert('Icon aktualisiert', 'Das App-Icon wurde im Projekt gespeichert.');
    } else {
      Alert.alert('Fehler', 'Konnte das Bild nicht als Base64 laden.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>

        {/* APP-EINSTELLUNGEN */}
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

        <Text style={styles.label}>App Icon:</Text>
        <TouchableOpacity onPress={handleChooseIcon} style={styles.iconButton}>
          {iconPreview ? (
            <Image
              source={{ uri: iconPreview }}
              style={styles.iconPreview}
            />
          ) : (
            <Ionicons name="image-outline" size={24} color={theme.palette.text.secondary} />
          )}
          <Text style={styles.iconButtonText}>App Icon ändern...</Text>
        </TouchableOpacity>

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
            <Text style={styles.infoValue}>{TEMPLATE_INFO.files}</Text>
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
            <Text style={styles.infoValue}>{projectData?.files?.length || 0}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nachrichten:</Text>
            <Text style={styles.infoValue}>{projectData?.messages?.length || 0}</Text>
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.palette.background },
  container: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: theme.palette.text.primary, marginTop: 20, marginBottom: 12 },
  settingsContainer: { marginBottom: 16 },
  label: { fontSize: 14, color: theme.palette.text.secondary, marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, backgroundColor: theme.palette.input.background, borderRadius: 8, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 10, color: theme.palette.text.primary, fontSize: 14, borderWidth: 1, borderColor: theme.palette.border },
  saveButton: { padding: 8, marginLeft: 10 },
  hint: { fontSize: 12, color: theme.palette.text.secondary, marginTop: 5, fontStyle: 'italic' },
  iconButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.palette.card, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: theme.palette.border, marginBottom: 8 },
  iconButtonText: { marginLeft: 12, fontSize: 14, color: theme.palette.text.secondary },
  iconPreview: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  templateInfoContainer: { backgroundColor: theme.palette.card, borderRadius: 8, padding: 16, borderWidth: 1, borderColor: theme.palette.border, marginBottom: 8 },
  projectInfoContainer: { backgroundColor: theme.palette.card, borderRadius: 8, padding: 16, borderWidth: 1, borderColor: theme.palette.border },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.palette.border },
  infoLabel: { fontSize: 14, color: theme.palette.text.secondary },
  infoValue: { fontSize: 14, fontWeight: 'bold', color: theme.palette.primary },
  infoValueMono: { fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: theme.palette.primary, maxWidth: '60%' },
  infoHint: { fontSize: 12, color: theme.palette.text.disabled, marginTop: 10, fontStyle: 'italic' },
});

export default AppInfoScreen;

