// screens/KeyBackupScreen.tsx – Backup & Restore für Tokens + AI-Keys

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { theme } from '../theme';
import { SUPABASE_STORAGE_KEYS } from '../lib/supabaseConfig';
import { useAI } from '../contexts/AIContext';
import { Ionicons } from '@expo/vector-icons';

// Keys, die wir in AsyncStorage sichern
const STORAGE_KEYS = [
  SUPABASE_STORAGE_KEYS.RAW,
  SUPABASE_STORAGE_KEYS.URL,
  SUPABASE_STORAGE_KEYS.KEY,
  'github_token',
  'eas_token',
  'eas_project_id',
];

const KeyBackupScreen: React.FC = () => {
  const { config, addApiKey } = useAI();
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  // EXPORT
  const handleExportFile = async () => {
    try {
      const storageData: Record<string, string> = {};

      // 1. Tokens aus AsyncStorage
      for (const key of STORAGE_KEYS) {
        const val = await AsyncStorage.getItem(key);
        if (val) storageData[key] = val;
      }

      // 2. AI-Config-Keys
      const payload = {
        version: 'k1w1-keys-v2',
        date: new Date().toISOString(),
        storage: storageData,
        aiKeys: config.apiKeys,
      };

      const path = FileSystem.cacheDirectory + 'k1w1_keys_backup.json';
      await FileSystem.writeAsStringAsync(
        path,
        JSON.stringify(payload, null, 2),
      );

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: 'application/json',
          UTI: 'public.json',
        });
        setLastBackup(new Date().toLocaleTimeString());
      } else {
        Alert.alert(
          'Fehler',
          'Teilen auf diesem Gerät ist nicht verfügbar.',
        );
      }
    } catch (e: any) {
      Alert.alert('Export Fehler', e?.message || 'Unbekannter Fehler.');
    }
  };

  // IMPORT
  const handleImportFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;

      const content = await FileSystem.readAsStringAsync(res.assets[0].uri);
      const data = JSON.parse(content);

      if (data.version !== 'k1w1-keys-v2' && !data.aiKeys) {
        Alert.alert(
          'Fehler',
          'Ungültiges Format oder alte Version der Backup-Datei.',
        );
        return;
      }

      Alert.alert(
        'Keys importieren',
        'Das überschreibt aktuelle Keys und Tokens. Fortfahren?',
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Importieren',
            style: 'destructive',
            onPress: async () => {
              // AsyncStorage wiederherstellen
              if (data.storage) {
                for (const [k, v] of Object.entries(
                  data.storage as Record<string, string>,
                )) {
                  await AsyncStorage.setItem(k, v);
                }
              }

              // AI-Keys wiederherstellen
              if (data.aiKeys) {
                const validProviders = [
                  'groq', 'gemini', 'google', 'openai', 'anthropic', 
                  'huggingface', 'openrouter', 'deepseek', 'xai', 'ollama'
                ];
                for (const provider of Object.keys(
                  data.aiKeys as Record<string, string[]>,
                )) {
                  if (!validProviders.includes(provider)) continue;
                  const keys = (data.aiKeys as Record<string, string[]>)[
                    provider
                  ];
                  for (const key of keys) {
                    await addApiKey(provider as any, key);
                  }
                }
              }

              Alert.alert('Fertig', 'Keys und Tokens wurden importiert.');
            },
          },
        ],
      );
    } catch (e: any) {
      Alert.alert('Import Fehler', e?.message || 'Unbekannter Fehler.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Key-Backup</Text>
        <Text style={styles.subtitle}>
          Sichere deine Supabase-, GitHub- & EAS-Tokens sowie KI-API-Keys in
          einer JSON-Datei.
        </Text>

        <TouchableOpacity
          style={styles.buttonPrimary}
          onPress={handleExportFile}
        >
          <Ionicons
            name="download-outline"
            size={18}
            color={theme.palette.background}
          />
          <Text style={styles.buttonPrimaryText}>Backup erstellen</Text>
        </TouchableOpacity>

        {lastBackup && (
          <Text style={styles.infoText}>
            Letztes Backup: {lastBackup}
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Key-Import</Text>
        <Text style={styles.subtitle}>
          Lade eine zuvor exportierte Backup-Datei, um Tokens & API-Keys
          wiederherzustellen.
        </Text>

        <TouchableOpacity
          style={styles.buttonSecondary}
          onPress={handleImportFile}
        >
          <Ionicons
            name="cloud-upload-outline"
            size={18}
            color={theme.palette.primary}
          />
          <Text style={styles.buttonSecondaryText}>
            Backup importieren
          </Text>
        </TouchableOpacity>

        <View style={styles.warningBox}>
          <Ionicons
            name="warning-outline"
            size={18}
            color={theme.palette.warning}
          />
          <Text style={styles.warningText}>
            Import überschreibt vorhandene Tokens & Keys. Verwende nur
            vertrauenswürdige Dateien.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: theme.palette.background,
    flexGrow: 1,
  },
  card: {
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.palette.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    marginBottom: 12,
  },
  buttonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.palette.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  buttonPrimaryText: {
    color: theme.palette.background,
    fontWeight: '600',
    marginLeft: 6,
  },
  buttonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: theme.palette.primary,
    marginTop: 4,
  },
  buttonSecondaryText: {
    color: theme.palette.primary,
    fontWeight: '600',
    marginLeft: 6,
  },
  infoText: {
    marginTop: 8,
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  warningBox: {
    flexDirection: 'row',
    marginTop: 12,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 170, 0, 0.08)',
    borderWidth: 1,
    borderColor: theme.palette.warning,
  },
  warningText: {
    marginLeft: 8,
    fontSize: 12,
    color: theme.palette.text.secondary,
    flex: 1,
  },
});

export default KeyBackupScreen;
