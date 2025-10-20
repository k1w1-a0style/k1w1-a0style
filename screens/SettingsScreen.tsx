import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { useAI, SUPPORTED_PROVIDERS, AIProvider as AIProviderType } from '../contexts/AIContext';

interface ModelConfig { id: string; name: string; description: string; provider: AIProviderType; }
const AVAILABLE_MODELS: Record<AIProviderType, ModelConfig[]> = {
  groq: [
    { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', description: 'Schnell, groß, stabil (Code)', provider: 'groq' },
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Stark bei UI/UX & Code', provider: 'groq' },
    { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', description: 'Starkes log. Denken (Debug)', provider: 'groq' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: 'Sehr schnell & günstig (Snippets)', provider: 'groq' }
  ],
  openai: [
    { id: 'gpt-4.1-turbo', name: 'GPT-4.1 Turbo', description: 'Aktuellstes Top-Modell (Annahme)', provider: 'openai' },
    { id: 'gpt-oss-120b', name: 'GPT-OSS 120B', description: 'Starkes log. Denken', provider: 'openai' },
    { id: 'gpt-oss-20b', name: 'GPT-OSS 20B', description: 'Guter Allrounder', provider: 'openai' }
  ],
  gemini: [
    { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro', description: 'Großes Kontextfenster (1M+)', provider: 'gemini' },
    { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash', description: 'Schnellere Variante', provider: 'gemini' }
  ],
  anthropic: [
    { id: 'claude-4.5-sonnet', name: 'Claude 4.5 Sonnet', description: 'Neuestes Sonnet, Code', provider: 'anthropic' },
    { id: 'claude-4.1-opus', name: 'Claude 4.1 Opus', description: 'Neuestes Top-Modell', provider: 'anthropic' }
  ],
  perplexity: [
     { id: 'pplx-7b-online', name: 'Pplx 7B Online', description: 'Online-Zugriff, schnell', provider: 'perplexity' },
     { id: 'pplx-70b-online', name: 'Pplx 70B Online', description: 'Online-Zugriff, stärker', provider: 'perplexity' }
  ]
};

type ApiKeyState = Partial<Record<AIProviderType, string>>;
const API_KEY_PREFIX = 'api_key_';

const SettingsScreen = () => {
  const { selectedProvider, setSelectedProvider, selectedMode, setSelectedMode } = useAI();
  const [apiKeys, setApiKeys] = useState<ApiKeyState>({});
  const [currentInputValue, setCurrentInputValue] = useState('');

  useEffect(() => {
    const loadAllApiKeys = async () => {
      try {
        const keysToLoad = SUPPORTED_PROVIDERS.map(p => API_KEY_PREFIX + p);
        const loadedData = await AsyncStorage.multiGet(keysToLoad);
        const loadedKeys: ApiKeyState = {};
        loadedData.forEach(([key, value]) => {
          if (value !== null) {
            const providerName = key.substring(API_KEY_PREFIX.length) as AIProviderType;
            loadedKeys[providerName] = value;
          }
        });
        setApiKeys(loadedKeys);
        // @ts-ignore
        setCurrentInputValue(loadedKeys[selectedProvider] || '');
      } catch (e) { Alert.alert('Fehler', 'API-Schlüssel laden fehlgeschlagen.'); }
    };
    loadAllApiKeys();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // @ts-ignore
    setCurrentInputValue(apiKeys[selectedProvider] || '');
  }, [selectedProvider, apiKeys]);

  const saveCurrentApiKey = useCallback(async () => {
    const keyName = selectedProvider;
    const valueToSave = currentInputValue;
    const storageKey = `${API_KEY_PREFIX}${keyName}`;
    try {
      await AsyncStorage.setItem(storageKey, valueToSave);
      setApiKeys(prev => ({ ...prev, [keyName]: valueToSave }));
      Alert.alert('Gespeichert', `${keyName.toUpperCase()} Key gespeichert.`);
    } catch (e) { Alert.alert('Fehler', `${keyName} Key speichern fehlgeschlagen.`); }
  }, [currentInputValue, selectedProvider]);

  const renderModelSelection = useCallback((provider: AIProviderType) => {
    const models = AVAILABLE_MODELS[provider]; if (!models || models.length === 0) return null; const isGroq = provider === 'groq';
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

  const renderApiKeyInput = useCallback((provider: AIProviderType) => {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{provider.charAt(0).toUpperCase() + provider.slice(1)} API Key</Text>
        <TextInput
          style={styles.input}
          placeholder={`${provider.toUpperCase()} API Key hier einfügen...`}
          placeholderTextColor={theme.palette.input.placeholder}
          value={currentInputValue}
          onChangeText={setCurrentInputValue}
          secureTextEntry={true}
          autoCapitalize="none" autoCorrect={false}
        />
        <TouchableOpacity style={styles.button} onPress={saveCurrentApiKey}>
          <Text style={styles.buttonText}>Key Speichern</Text>
        </TouchableOpacity>
      </View>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentInputValue, selectedProvider]);

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
        {selectedProvider && renderApiKeyInput(selectedProvider)}

        {/* Die "Verbindungen" (Supabase/GitHub) sind jetzt in einem separaten Screen */}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.palette.background }, container: { flex: 1 }, scrollContent: { paddingHorizontal: 15, paddingTop: 10 }, title: { fontSize: 22, fontWeight: 'bold', color: theme.palette.text.primary, marginTop: 10, marginBottom: 15 }, card: { backgroundColor: theme.palette.card, borderRadius: 12, padding: 18, marginBottom: 20, }, cardTitle: { fontSize: 18, fontWeight: '600', color: theme.palette.text.primary, marginBottom: 12 }, input: { backgroundColor: theme.palette.input.background, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 15, color: theme.palette.text.primary, fontSize: 16, marginBottom: 15, borderWidth: 1, borderColor: '#444' }, button: { backgroundColor: theme.palette.primary, paddingVertical: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 48 }, buttonText: { color: theme.palette.background, fontSize: 16, fontWeight: 'bold' }, providerSelectionContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20, backgroundColor: theme.palette.card, borderRadius: 12, padding: 10, }, providerButton: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8, borderWidth: 1, borderColor: theme.palette.text.secondary, marginRight: 10, marginBottom: 10 }, providerButtonSelected: { backgroundColor: theme.palette.primary, borderColor: theme.palette.primary }, providerButtonText: { color: theme.palette.text.secondary, fontSize: 16, fontWeight: '500' }, providerButtonTextSelected: { color: theme.palette.background, fontWeight: 'bold' }, modelSelectionContainer: { backgroundColor: theme.palette.card, borderRadius: 12, padding: 15, marginBottom: 20 }, modelTitle: { fontSize: 16, fontWeight: '600', color: theme.palette.text.secondary, marginBottom: 10 }, modelButton: { paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, borderWidth: 1, borderColor: '#555', marginBottom: 10, }, modelButtonSelected: { borderColor: theme.palette.primary, backgroundColor: theme.palette.primary + '30' }, modelButtonText: { color: theme.palette.text.primary, fontSize: 16, fontWeight: '500' }, modelButtonTextSelected: { fontWeight: 'bold' }, modelDescription: { color: theme.palette.text.secondary, fontSize: 12, marginTop: 4 }, modelDescriptionSelected: { color: theme.palette.text.primary }, apiKeyContainer: { backgroundColor: theme.palette.card, borderRadius: 12, padding: 15, }, apiKeyLabel: { fontSize: 16, fontWeight: '600', color: theme.palette.text.secondary, marginBottom: 10 },
});

export default SettingsScreen;
