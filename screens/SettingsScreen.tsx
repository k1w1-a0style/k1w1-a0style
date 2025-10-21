import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { useAI, SUPPORTED_PROVIDERS, AIProvider as AIProviderType } from '../contexts/AIContext';
import { Ionicons } from '@expo/vector-icons';

// === FINALE MODELL-LISTE (Bereinigt) ===
interface ModelConfig { id: string; name: string; description: string; provider: AIProviderType; }
const AVAILABLE_MODELS: Record<AIProviderType, ModelConfig[]> = {
  // Groq
  groq: [
    { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', description: 'Schnell, groß, stabil (Code)', provider: 'groq' },
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Stark bei UI/UX & Code', provider: 'groq' },
    { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', description: 'Starkes log. Denken (Debug)', provider: 'groq' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: 'Sehr schnell & günstig (Snippets)', provider: 'groq' },
    { id: 'qwen/qwen3-32b', name: 'Qwen3 32B', description: 'Alternatives Allrounder-Modell', provider: 'groq' },
    { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout', description: 'Neues Scout-Modell', provider: 'groq' }
  ],
  // OpenAI
  openai: [
    { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Hohe Code-Qualität & Refactoring', provider: 'openai' },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Neuestes Omni-Modell', provider: 'openai' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Standard (für Keys mit Limit)', provider: 'openai' }
  ],
  // Gemini (Beschreibungen korrigiert)
  gemini: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Schnell & effizient (verfügbar)', provider: 'gemini' },
    { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro', description: 'Großes Kontextfenster (1M+)', provider: 'gemini' },
    { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash', description: 'Schnelle Variante', provider: 'gemini' }
  ],
  // Anthropic
  anthropic: [
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude 4.5 Sonnet', description: 'Neuestes Sonnet (Coding)', provider: 'anthropic' },
    { id: 'claude-opus-4-1-20250805', name: 'Claude 4.1 Opus', description: 'Neuestes Top-Modell (Komplex)', provider: 'anthropic' },
    { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', description: 'Guter Allrounder', provider: 'anthropic' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Schnellstes & günstigstes Modell', provider: 'anthropic' }
  ]
};
// === ENDE MODELL-LISTE ===

const maskKey = (key: string) => {
  if (!key || key.length < 8) return "ungültiger Key";
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
};

const SettingsScreen = () => {
  const { config, setSelectedProvider, setSelectedMode, addApiKey, removeApiKey } = useAI();
  const { selectedProvider, selectedMode, keys, keyIndexes } = config;
  
  const [newKeyInput, setNewKeyInput] = useState('');

  const handleAddKey = () => {
    if (!newKeyInput.trim()) {
      Alert.alert("Eingabe leer", "Bitte API-Key einfügen.");
      return;
    }
    addApiKey(selectedProvider, newKeyInput.trim());
    setNewKeyInput('');
  };

  const renderModelSelection = useCallback((provider: AIProviderType) => {
    const models = AVAILABLE_MODELS[provider]; 
    if (!models || models.length === 0) return null; 
    const isGroq = provider === 'groq';
    
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Modell auswählen</Text>
        {models.map(model => (
          <TouchableOpacity key={model.id} style={[styles.modelButton, selectedMode === model.id && styles.modelButtonSelected]} onPress={() => setSelectedMode(model.id)}>
            <Text style={[styles.modelButtonText, selectedMode === model.id && styles.modelButtonTextSelected]}>{model.name}</Text>
            <Text style={[styles.modelDescription, selectedMode === model.id && styles.modelDescriptionSelected]}>{model.description}</Text>
          </TouchableOpacity>
        ))}
        {isGroq && (
          <TouchableOpacity key="auto-groq" style={[styles.modelButton, selectedMode === 'auto-groq' && styles.modelButtonSelected]} onPress={() => setSelectedMode('auto-groq')}>
            <Text style={[styles.modelButtonText, selectedMode === 'auto-groq' && styles.modelButtonTextSelected]}>Auto-Groq</Text>
            <Text style={[styles.modelDescription, selectedMode === 'auto-groq' && styles.modelDescriptionSelected]}>Wählt bestes Modell automatisch</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [selectedMode, selectedProvider, setSelectedMode]);

  const renderApiKeyManagement = useCallback((provider: AIProviderType) => {
    const keyList = keys[provider] || [];
    const currentIndex = keyIndexes[provider] || 0;
    
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{provider.charAt(0).toUpperCase() + provider.slice(1)} API Keys</Text>
        
        <View style={styles.keyListContainer}>
          {keyList.length === 0 ? (
              <Text style={styles.modelDescription}>Keine Keys gespeichert.</Text>
          ) : (
              keyList.map((key, index) => (
                <View key={index} style={styles.keyRow}>
                  <View style={styles.keyInfo}>
                    <Text style={[styles.keyText, index === currentIndex && styles.keyTextActive]}>{maskKey(key)}</Text>
                    {index === currentIndex && (
                      <Text style={styles.keyStatus}>(Aktiv)</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => removeApiKey(provider, key)}>
                    <Ionicons name="trash-outline" size={22} color={theme.palette.text.secondary} />
                  </TouchableOpacity>
                </View>
              ))
          )}
        </View>

        <View style={styles.addKeyContainer}>
          <TextInput
            style={styles.input}
            placeholder="Neuen API Key hier einfügen..."
            placeholderTextColor={theme.palette.input.placeholder}
            value={newKeyInput}
            onChangeText={setNewKeyInput}
            secureTextEntry={true}
            autoCapitalize="none" autoCorrect={false}
          />
          <TouchableOpacity style={styles.button} onPress={handleAddKey}>
            <Text style={styles.buttonText}>Key Hinzufügen</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [keys, keyIndexes, selectedProvider, newKeyInput, addApiKey, removeApiKey]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <StatusBar style="light" />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>

        <Text style={styles.title}>Aktiver KI-Anbieter</Text>
        <View style={styles.providerSelectionContainer}>
          {SUPPORTED_PROVIDERS.map((provider) => (
            <TouchableOpacity
              key={provider}
              style={[ styles.providerButton, selectedProvider === provider && styles.providerButtonSelected ]}
              onPress={() => setSelectedProvider(provider)}
            >
              <Text style={[ styles.providerButtonText, selectedProvider === provider && styles.providerButtonTextSelected ]}>
                {provider.charAt(0).toUpperCase() + provider.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedProvider && renderModelSelection(selectedProvider)}
        {selectedProvider && renderApiKeyManagement(selectedProvider)}
        
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.palette.background }, 
  container: { flex: 1 }, 
  scrollContent: { paddingHorizontal: 15, paddingTop: 10 }, 
  title: { fontSize: 22, fontWeight: 'bold', color: theme.palette.text.primary, marginTop: 10, marginBottom: 15 }, 
  card: { backgroundColor: theme.palette.card, borderRadius: 12, padding: 18, marginBottom: 20, }, 
  cardTitle: { fontSize: 18, fontWeight: '600', color: theme.palette.text.primary, marginBottom: 12 }, 
  input: { backgroundColor: theme.palette.input.background, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 15, color: theme.palette.text.primary, fontSize: 16, marginBottom: 15, borderWidth: 1, borderColor: '#444' }, 
  button: { backgroundColor: theme.palette.primary, paddingVertical: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 48 }, 
  buttonText: { color: theme.palette.background, fontSize: 16, fontWeight: 'bold' }, 
  providerSelectionContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 5, backgroundColor: theme.palette.card, borderRadius: 12, padding: 10, }, 
  providerButton: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8, borderWidth: 1, borderColor: theme.palette.text.secondary, marginRight: 10, marginBottom: 10 }, 
  providerButtonSelected: { backgroundColor: theme.palette.primary, borderColor: theme.palette.primary }, 
  providerButtonText: { color: theme.palette.text.secondary, fontSize: 16, fontWeight: '500' }, 
  providerButtonTextSelected: { color: theme.palette.background, fontWeight: 'bold' }, 
  modelSelectionContainer: { backgroundColor: theme.palette.card, borderRadius: 12, padding: 15, marginBottom: 20 }, 
  modelTitle: { fontSize: 16, fontWeight: '600', color: theme.palette.text.secondary, marginBottom: 10 }, 
  modelButton: { paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, borderWidth: 1, borderColor: '#555', marginBottom: 10, }, 
  modelButtonSelected: { borderColor: theme.palette.primary, backgroundColor: theme.palette.primary + '30' }, 
  modelButtonText: { color: theme.palette.text.primary, fontSize: 16, fontWeight: '500' }, 
  modelButtonTextSelected: { fontWeight: 'bold' }, 
  modelDescription: { color: theme.palette.text.secondary, fontSize: 12, marginTop: 4 }, 
  modelDescriptionSelected: { color: theme.palette.text.primary }, 
  keyListContainer: {
    marginBottom: 15,
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.input.background,
  },
  keyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  keyText: {
    color: theme.palette.text.secondary,
    fontSize: 14,
    fontFamily: 'monospace',
    flexShrink: 1,
  },
  keyTextActive: {
    color: theme.palette.text.primary,
    fontWeight: 'bold',
  },
  keyStatus: {
    color: theme.palette.primary,
    fontSize: 14,
    marginLeft: 10,
    fontWeight: 'bold',
  },
  addKeyContainer: {
    marginTop: 10,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#333',
  }
});

export default SettingsScreen;
