import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context'; // Korrekter Import
import { theme } from '../theme'; // Theme importieren

type ApiKeyName =
  | 'supabase_url' | 'supabase_key' | 'github_key'
  | 'groq_key' | 'openai_key' | 'gemini_key' | 'claude_key' | 'perplexity_key';

const connectionServices = [
  { key: 'supabase_url' as ApiKeyName, name: 'Supabase URL' },
  { key: 'supabase_key' as ApiKeyName, name: 'Supabase Key' },
  { key: 'github_key' as ApiKeyName, name: 'GitHub Token' },
];

const aiServices = [
  { key: 'groq_key' as ApiKeyName, name: 'Groq' },
  { key: 'openai_key' as ApiKeyName, name: 'OpenAI' },
  { key: 'gemini_key' as ApiKeyName, name: 'Gemini' },
  { key: 'claude_key' as ApiKeyName, name: 'Claude' },
  { key: 'perplexity_key' as ApiKeyName, name: 'Perplexity' },
];

const SettingsScreen = () => {
  // Initialisiere State korrekt
  const [keys, setKeys] = useState<Record<ApiKeyName, string>>(() => {
    const initialKeys: Partial<Record<ApiKeyName, string>> = {};
    [...connectionServices, ...aiServices].forEach(s => {
      initialKeys[s.key] = '';
    });
    return initialKeys as Record<ApiKeyName, string>;
  });

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      const allKeys: ApiKeyName[] = [...connectionServices.map(s => s.key), ...aiServices.map(s => s.key)];
      const loadedKeysUpdate: Partial<Record<ApiKeyName, string>> = {};
      for (const key of allKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value !== null) { // Prüfe auf null statt nur truthy
          loadedKeysUpdate[key] = value;
        }
      }
      // Verwende funktionale Form für State Update
      setKeys(prevKeys => ({ ...prevKeys, ...loadedKeysUpdate }));
    } catch (e) {
      console.error("Fehler beim Laden der Keys:", e);
      Alert.alert('Fehler', 'API-Schlüssel konnten nicht geladen werden.');
    }
  };

  const saveKey = async (key: ApiKeyName) => {
    try {
      const valueToSave = keys[key]; // Hole den Wert aus dem State
      if (valueToSave === undefined) {
         console.warn(`Versuch, undefinierten Key zu speichern: ${key}`);
         Alert.alert('Fehler', 'Interner Fehler: Schlüssel nicht im State gefunden.');
         return;
      }
      await AsyncStorage.setItem(key, valueToSave);
      Alert.alert('Gespeichert', `${key.replace('_', ' ').replace('key', 'Key').replace('url', 'URL')} wurde gespeichert.`);
    } catch (e) {
      console.error(`Fehler beim Speichern von ${key}:`, e);
      Alert.alert('Fehler', `${key} konnte nicht gespeichert werden.`);
    }
  };

  const handleInputChange = (key: ApiKeyName, value: string) => {
    // Verwende funktionale Form für State Update
    setKeys(prev => ({ ...prev, [key]: value }));
  };

  const renderCard = (service: { key: ApiKeyName, name: string }) => (
    <View style={styles.card} key={service.key}>
      <Text style={styles.cardTitle}>{service.name}</Text>
      <TextInput
        style={styles.input}
        placeholder={`${service.name} hier einfügen...`}
        placeholderTextColor={theme.palette.input.placeholder}
        value={keys[service.key]} // Lese Wert aus dem State
        onChangeText={(text) => handleInputChange(service.key, text)}
        secureTextEntry={!service.key.endsWith('_url') && service.key !== 'github_token'} // GitHub Token auch sichtbar? Ggf. anpassen
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity style={styles.button} onPress={() => saveKey(service.key)}>
        <Text style={styles.buttonText}>Speichern</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    // SafeAreaView für korrekten Abstand
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <StatusBar style="light" />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Verbindungen</Text>
        {connectionServices.map(renderCard)}

        <Text style={styles.title}>KI-Anbieter</Text>
        {aiServices.map(renderCard)}
        {/* Platzhalter am Ende für besseres Scrollen */}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// Styles mit Theme-Farben
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 15, // Padding für ScrollView Inhalt
    paddingTop: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.palette.text.primary,
    marginTop: 20,
    marginBottom: 15,
  },
  card: {
    backgroundColor: theme.palette.card,
    borderRadius: 12, // Etwas runder
    padding: 18,
    marginBottom: 20,
    shadowColor: "#000", // Leichter Schatten (optional)
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600', // Semi-Bold
    color: theme.palette.text.primary,
    marginBottom: 12,
  },
  input: {
    backgroundColor: theme.palette.input.background,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 15,
    color: theme.palette.text.primary,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1, // Leichter Rand
    borderColor: '#444', // Dunkelgrauer Rand
  },
  button: {
    backgroundColor: theme.palette.primary, // Neongrün
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center', // Text zentrieren
    minHeight: 48, // Mindesthöhe für bessere Klickbarkeit
  },
  buttonText: {
    color: theme.palette.background, // Dunkler Text auf Neongrün
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SettingsScreen;
