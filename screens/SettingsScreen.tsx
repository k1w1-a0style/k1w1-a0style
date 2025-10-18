import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

// Definiert die Namen für die Schlüssel, um Tippfehler zu vermeiden
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
  const [apiKeys, setApiKeys] = useState<Record<ApiKeyName, string>>({
    supabase_url: '', supabase_key: '', github_key: '', groq_key: '',
    openai_key: '', gemini_key: '', claude_key: '', perplexity_key: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const allKeys = Object.keys(apiKeys) as ApiKeyName[];
      const storedValues = await AsyncStorage.multiGet(allKeys);
      const loadedKeys = { ...apiKeys };
      storedValues.forEach(([key, value]) => {
        if (value) {
          loadedKeys[key as ApiKeyName] = value;
        }
      });
      setApiKeys(loadedKeys);
    } catch {
      Alert.alert('Fehler', 'Einstellungen konnten nicht geladen werden.');
    }
  };

  const handleSave = async (key: ApiKeyName, name: string) => {
    try {
      await AsyncStorage.setItem(key, apiKeys[key]);
      Alert.alert('Gespeichert', `${name} wurde erfolgreich gespeichert.`);
    } catch {
      Alert.alert('Fehler', `Konnte ${name} nicht speichern.`);
    }
  };

  const renderCard = (service: { key: ApiKeyName; name: string }) => (
    <View style={styles.card} key={service.key}>
      <Text style={styles.cardTitle}>{service.name}</Text>
      <TextInput
        style={styles.input}
        value={apiKeys[service.key]}
        onChangeText={text => setApiKeys(prev => ({ ...prev, [service.key]: text }))}
        placeholder={`${service.name} hier einfügen...`}
        placeholderTextColor="#555"
        secureTextEntry
      />
      <TouchableOpacity style={styles.saveButton} onPress={() => handleSave(service.key, service.name)}>
        <Text style={styles.saveButtonText}>Speichern</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.sectionTitle}>Verbindungen</Text>
      {connectionServices.map(renderCard)}
      <Text style={styles.sectionTitle}>KI-Anbieter</Text>
      {aiServices.map(renderCard)}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f21',
    padding: 15,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a2b4e',
    paddingBottom: 5,
  },
  card: {
    backgroundColor: '#131e3a',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#0a0f21',
    color: 'white',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 5,
    fontSize: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1a2b4e',
  },
  saveButton: {
    backgroundColor: '#00ff4c',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#0a0f21',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default SettingsScreen;
