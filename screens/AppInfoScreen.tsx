import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useProject } from '../contexts/ProjectContext';

// ✅ Template-Info
const TEMPLATE_INFO = {
  name: "Expo SDK 54 Basis",
  version: "1.0.0",
  sdkVersion: "54.0.18",
  rnVersion: "0.81.4",
  files: 5
};

const AppInfoScreen = () => {
  const { projectData, setProjectName } = useProject();
  const [appName, setAppName] = useState('');
  const [packageName, setPackageName] = useState('');

  // ✅ Lade aktuelle Werte aus Projekt
  useEffect(() => {
    if (projectData) {
      setAppName(projectData.name || 'Meine App');

      // Extrahiere Package Name aus package.json
      const pkgJson = projectData.files?.find(f => f.path === 'package.json');
      if (pkgJson && typeof pkgJson.content === 'string') {
        try {
          const parsed = JSON.parse(pkgJson.content);
          setPackageName(parsed.name || 'meine-app');
        } catch (e) {
          setPackageName('meine-app');
        }
      }
    }
  }, [projectData]);

  const handleSaveAppName = async () => {
    if (appName.trim()) {
      await setProjectName(appName.trim());
      Alert.alert('Gespeichert', `App-Name: "${appName.trim()}"`);
    }
  };

  const handleSavePackageName = () => {
    // TODO: Implementiere package.json Update
    Alert.alert('TODO', 'Package Name Update noch nicht implementiert.');
  };

  const handleChooseIcon = () => {
    Alert.alert('TODO', 'Icon-Auswahl noch nicht implementiert.');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>

        {/* ✅ APP-EINSTELLUNGEN */}
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
          <Text style={styles.label}>Package Name:</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={packageName}
              onChangeText={setPackageName}
              placeholder="com.meine.app"
              placeholderTextColor={theme.palette.text.secondary}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={handleSavePackageName} style={styles.saveButton}>
              <Ionicons name="checkmark" size={24} color={theme.palette.text.disabled} />
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>⚠️ Package Name Update noch nicht implementiert</Text>
        </View>

        <TouchableOpacity onPress={handleChooseIcon} style={styles.iconButton}>
          <Ionicons name="image-outline" size={24} color={theme.palette.text.secondary} />
          <Text style={styles.iconButtonText}>App Icon ändern (TODO)</Text>
        </TouchableOpacity>

        {/* ✅ TEMPLATE-INFO */}
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

        {/* ✅ PROJEKT-INFO */}
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
  hint: { fontSize: 12, color: theme.palette.text.disabled, marginTop: 5, fontStyle: 'italic' },
  iconButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.palette.card, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: theme.palette.border, marginBottom: 8 },
  iconButtonText: { marginLeft: 12, fontSize: 14, color: theme.palette.text.secondary },
  templateInfoContainer: { backgroundColor: theme.palette.card, borderRadius: 8, padding: 16, borderWidth: 1, borderColor: theme.palette.border, marginBottom: 8 },
  projectInfoContainer: { backgroundColor: theme.palette.card, borderRadius: 8, padding: 16, borderWidth: 1, borderColor: theme.palette.border },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.palette.border },
  infoLabel: { fontSize: 14, color: theme.palette.text.secondary },
  infoValue: { fontSize: 14, fontWeight: 'bold', color: theme.palette.primary },
  infoValueMono: { fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: theme.palette.primary, maxWidth: '60%' },
  infoHint: { fontSize: 12, color: theme.palette.text.disabled, marginTop: 10, fontStyle: 'italic' },
});

export default AppInfoScreen;
