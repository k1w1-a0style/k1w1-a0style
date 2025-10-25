import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAI, SUPPORTED_PROVIDERS, AIProvider as AIProviderType } from '../contexts/AIContext';

const AVAILABLE_MODELS: Record<AIProviderType, { id: string; label: string }[]> = {
  groq: [
    { id: 'auto-groq', label: 'Auto (Groq)' },
    { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B' },
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
    { id: 'qwen/qwen3-32b', label: 'Qwen 3 32B' },
    { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B' }
  ],
  openai: [
    { id: 'gpt-4.1', label: 'GPT-4.1' },
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
  ],
  gemini: [
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { id: 'gemini-1.5-pro-latest', label: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash-latest', label: 'Gemini 1.5 Flash' }
  ],
  anthropic: [
    { id: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
    { id: 'claude-opus-4-1-20250805', label: 'Claude Opus 4.1' },
    { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
    { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' }
  ]
};

const SettingsScreen = () => {
  const { config, setSelectedProvider, setSelectedMode, addApiKey, removeApiKey, getCurrentApiKey } = useAI();
  const [newKey, setNewKey] = useState('');

  const handleProviderChange = async (provider: AIProviderType) => {
    await setSelectedProvider(provider);
  };

  const handleModeChange = async (mode: string) => {
    await setSelectedMode(mode);
  };

  const handleAddKey = async () => {
    const trimmedKey = newKey.trim();
    if (!trimmedKey) {
      Alert.alert('Fehler', 'Bitte gib einen gültigen API Key ein.');
      return;
    }
    await addApiKey(config.selectedProvider, trimmedKey);
    setNewKey('');
  };

  const handleRemoveKey = async (key: string) => {
    Alert.alert(
      'Key löschen?',
      `Möchtest du diesen ${config.selectedProvider.toUpperCase()} Key wirklich entfernen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => removeApiKey(config.selectedProvider, key)
        }
      ]
    );
  };

  const currentKeys = config.keys[config.selectedProvider] || [];
  const availableModels = AVAILABLE_MODELS[config.selectedProvider] || [];
  const activeKey = getCurrentApiKey(config.selectedProvider);
  const activeKeyIndex = config.keyIndexes[config.selectedProvider] || 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        
        <Text style={styles.sectionTitle}>AI Provider</Text>
        <View style={styles.providerContainer}>
          {SUPPORTED_PROVIDERS.map((provider) => (
            <TouchableOpacity
              key={provider}
              style={[
                styles.providerButton,
                config.selectedProvider === provider && styles.providerButtonActive
              ]}
              onPress={() => handleProviderChange(provider)}
            >
              <Text
                style={[
                  styles.providerButtonText,
                  config.selectedProvider === provider && styles.providerButtonTextActive
                ]}
              >
                {provider.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Modell</Text>
        <View style={styles.modelContainer}>
          {availableModels.map((model) => (
            <TouchableOpacity
              key={model.id}
              style={[
                styles.modelButton,
                config.selectedMode === model.id && styles.modelButtonActive
              ]}
              onPress={() => handleModeChange(model.id)}
            >
              <Text
                style={[
                  styles.modelButtonText,
                  config.selectedMode === model.id && styles.modelButtonTextActive
                ]}
              >
                {model.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{`${config.selectedProvider.toUpperCase()} API Keys`}</Text>
        
        {currentKeys.length > 0 && activeKey && (
          <View style={styles.activeKeyBanner}>
            <Ionicons name="checkmark-circle" size={18} color={theme.palette.success} />
            <Text style={styles.activeKeyText}>
              Aktiv: Key #{activeKeyIndex + 1} ({activeKey.substring(0, 8)}...)
            </Text>
          </View>
        )}
        
        <View style={styles.addKeyContainer}>
          <TextInput
            style={styles.keyInput}
            placeholder={`${config.selectedProvider.toUpperCase()} API Key eingeben...`}
            placeholderTextColor={theme.palette.text.secondary}
            value={newKey}
            onChangeText={setNewKey}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddKey}>
            <Ionicons name="add-circle" size={28} color={theme.palette.primary} />
          </TouchableOpacity>
        </View>

        {currentKeys.length > 0 ? (
          <View style={styles.keysList}>
            {currentKeys.map((key, index) => {
              const isActive = index === activeKeyIndex;
              return (
                <View key={index} style={[styles.keyItem, isActive && styles.keyItemActive]}>
                  {isActive && <Ionicons name="star" size={16} color={theme.palette.success} style={styles.starIcon} />}
                  <Text style={[styles.keyText, isActive && styles.keyTextActive]} numberOfLines={1}>
                    #{index + 1}: {`${key.substring(0, 10)}...${key.substring(key.length - 4)}`}
                  </Text>
                  <TouchableOpacity onPress={() => handleRemoveKey(key)} style={styles.deleteButton}>
                    <Ionicons name="trash-outline" size={20} color={theme.palette.error} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyKeysContainer}>
            <Text style={styles.emptyKeysText}>Keine API Keys gespeichert.</Text>
          </View>
        )}

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={theme.palette.primary} />
          <Text style={styles.infoText}>
            Keys werden lokal auf deinem Gerät gespeichert und rotieren automatisch bei Fehlern. Der aktive Key ist mit ⭐ markiert.
          </Text>
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
  providerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  providerButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: theme.palette.card, borderWidth: 1, borderColor: theme.palette.border },
  providerButtonActive: { backgroundColor: theme.palette.primary, borderColor: theme.palette.primary },
  providerButtonText: { fontSize: 14, fontWeight: 'bold', color: theme.palette.text.primary },
  providerButtonTextActive: { color: theme.palette.background },
  modelContainer: { flexDirection: 'column', gap: 8 },
  modelButton: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, backgroundColor: theme.palette.card, borderWidth: 1, borderColor: theme.palette.border },
  modelButtonActive: { backgroundColor: theme.palette.primary, borderColor: theme.palette.primary },
  modelButtonText: { fontSize: 14, color: theme.palette.text.primary },
  modelButtonTextActive: { color: theme.palette.background, fontWeight: 'bold' },
  activeKeyBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.palette.card, padding: 10, borderRadius: 8, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: theme.palette.success },
  activeKeyText: { marginLeft: 8, fontSize: 13, color: theme.palette.success, fontWeight: 'bold' },
  addKeyContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  keyInput: { flex: 1, backgroundColor: theme.palette.input.background, borderRadius: 8, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 10, color: theme.palette.text.primary, fontSize: 14, borderWidth: 1, borderColor: theme.palette.border },
  addButton: { padding: 4 },
  keysList: { marginTop: 12, gap: 8 },
  keyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.palette.card, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: theme.palette.border },
  keyItemActive: { borderColor: theme.palette.success, borderWidth: 2 },
  starIcon: { marginRight: 8 },
  keyText: { flex: 1, fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: theme.palette.text.secondary },
  keyTextActive: { color: theme.palette.success, fontWeight: 'bold' },
  deleteButton: { padding: 4 },
  emptyKeysContainer: { marginTop: 12, padding: 20, backgroundColor: theme.palette.card, borderRadius: 8, alignItems: 'center' },
  emptyKeysText: { fontSize: 14, color: theme.palette.text.secondary },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 24, padding: 12, backgroundColor: theme.palette.card, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: theme.palette.primary },
  infoText: { flex: 1, marginLeft: 10, fontSize: 13, color: theme.palette.text.secondary, lineHeight: 18 },
});

export default SettingsScreen;
