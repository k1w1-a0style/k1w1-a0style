import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import {
  useAI,
  AVAILABLE_MODELS,
  CHAT_PROVIDER,
  AGENT_PROVIDER,
  QualityMode,
  AllAIProviders,
} from '../contexts/AIContext';

const getModelLabel = (provider: AllAIProviders, id: string): string => {
  const models = AVAILABLE_MODELS[provider] || [];
  const model = models.find(m => m.id === id);
  return model?.label || id.split('/').pop()?.replace(/_/g, ' ') || id;
};

const SettingsScreen = () => {
  const {
    config,
    setSelectedChatMode,
    setSelectedAgentMode,
    setQualityMode,
    addApiKey,
    removeApiKey,
    getCurrentApiKey,
  } = useAI();

  const [newGroqKey, setNewGroqKey] = useState('');
  const [newGeminiKey, setNewGeminiKey] = useState('');

  const handleChatModeChange = (mode: string) => setSelectedChatMode(mode);
  const handleAgentModeChange = (mode: string) => setSelectedAgentMode(mode);

  const handleQualityModeChange = (value: boolean) => {
    setQualityMode(value ? 'quality' : 'speed');
  };

  const handleAddKey = async (
    provider: AllAIProviders,
    key: string,
    setKeyState: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      Alert.alert('Fehler', 'Bitte gib einen gültigen API Key ein');
      return;
    }
    await addApiKey(provider, trimmedKey);
    setKeyState('');
  };

  const handleRemoveKey = (provider: AllAIProviders, key: string) => {
    Alert.alert('Key löschen?', `${provider.toUpperCase()} Key entfernen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () => removeApiKey(provider, key),
      },
    ]);
  };

  const currentGroqKeys = config.keys[CHAT_PROVIDER] || [];
  const currentGeminiKeys = config.keys[AGENT_PROVIDER] || [];
  const activeGroqKeyIndex = config.keyIndexes[CHAT_PROVIDER] || 0;
  const activeGeminiKeyIndex = config.keyIndexes[AGENT_PROVIDER] || 0;
  const activeGroqKey = getCurrentApiKey(CHAT_PROVIDER);
  const activeGeminiKey = getCurrentApiKey(AGENT_PROVIDER);

  const availableChatModels = AVAILABLE_MODELS[CHAT_PROVIDER] || [];
  const availableAgentModels = AVAILABLE_MODELS[AGENT_PROVIDER] || [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        
        {/* Quality Mode */}
        <Text style={styles.sectionTitle}>⚙️ Modus</Text>
        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>🚀 Schnell (1 Call)</Text>
          <Switch
            trackColor={{ false: theme.palette.text.disabled, true: theme.palette.primary }}
            thumbColor={Platform.OS === 'android' ? theme.palette.primary : ''}
            ios_backgroundColor={theme.palette.text.disabled}
            onValueChange={handleQualityModeChange}
            value={config.qualityMode === 'quality'}
          />
          <Text style={styles.switchLabel}>💎 Qualität (2 Calls)</Text>
        </View>
        <Text style={styles.infoText}>
          Qualitätsmodus: Gemini prüft die Groq-Antwort (langsamer, aber besser)
        </Text>

        {/* Groq Settings */}
        <Text style={styles.sectionTitle}>💬 Generator (Groq)</Text>
        <Text style={styles.subTitle}>Modell:</Text>
        <View style={styles.modelContainer}>
          {availableChatModels.map(model => (
            <TouchableOpacity
              key={model.id}
              style={[
                styles.modelButton,
                config.selectedChatMode === model.id && styles.modelButtonActive,
              ]}
              onPress={() => handleChatModeChange(model.id)}
            >
              <Text
                style={[
                  styles.modelButtonText,
                  config.selectedChatMode === model.id && styles.modelButtonTextActive,
                ]}
              >
                {getModelLabel(CHAT_PROVIDER, model.id)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.subTitle}>API Keys:</Text>
        {currentGroqKeys.length > 0 && activeGroqKey && (
          <View style={styles.activeKeyBanner}>
            <Ionicons name="checkmark-circle" size={18} color={theme.palette.success} />
            <Text style={styles.activeKeyText}>
              Aktiv: Key #{activeGroqKeyIndex + 1} ({activeGroqKey.substring(0, 5)}...)
            </Text>
          </View>
        )}
        <View style={styles.addKeyContainer}>
          <TextInput
            style={styles.keyInput}
            placeholder="Neuer Groq Key..."
            placeholderTextColor={theme.palette.text.secondary}
            value={newGroqKey}
            onChangeText={setNewGroqKey}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => handleAddKey(CHAT_PROVIDER, newGroqKey, setNewGroqKey)}
          >
            <Ionicons name="add-circle" size={28} color={theme.palette.primary} />
          </TouchableOpacity>
        </View>
        <KeyList
          keys={currentGroqKeys}
          provider={CHAT_PROVIDER}
          activeIndex={activeGroqKeyIndex}
          onRemove={handleRemoveKey}
        />

        {/* Gemini Settings */}
        <Text style={styles.sectionTitle}>🤖 Agent (Gemini)</Text>
        <Text style={styles.subTitle}>Modell (für Qualitätsmodus):</Text>
        <View style={styles.modelContainer}>
          {availableAgentModels.map(model => (
            <TouchableOpacity
              key={model.id}
              style={[
                styles.modelButton,
                config.selectedAgentMode === model.id && styles.modelButtonActive,
              ]}
              onPress={() => handleAgentModeChange(model.id)}
            >
              <Text
                style={[
                  styles.modelButtonText,
                  config.selectedAgentMode === model.id && styles.modelButtonTextActive,
                ]}
              >
                {getModelLabel(AGENT_PROVIDER, model.id)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.subTitle}>API Keys:</Text>
        {currentGeminiKeys.length > 0 && activeGeminiKey && (
          <View style={styles.activeKeyBanner}>
            <Ionicons name="checkmark-circle" size={18} color={theme.palette.success} />
            <Text style={styles.activeKeyText}>
              Aktiv: Key #{activeGeminiKeyIndex + 1} ({activeGeminiKey.substring(0, 5)}...)
            </Text>
          </View>
        )}
        <View style={styles.addKeyContainer}>
          <TextInput
            style={styles.keyInput}
            placeholder="Neuer Gemini Key..."
            placeholderTextColor={theme.palette.text.secondary}
            value={newGeminiKey}
            onChangeText={setNewGeminiKey}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => handleAddKey(AGENT_PROVIDER, newGeminiKey, setNewGeminiKey)}
          >
            <Ionicons name="add-circle" size={28} color={theme.palette.primary} />
          </TouchableOpacity>
        </View>
        <KeyList
          keys={currentGeminiKeys}
          provider={AGENT_PROVIDER}
          activeIndex={activeGeminiKeyIndex}
          onRemove={handleRemoveKey}
        />

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={theme.palette.primary} />
          <Text style={styles.infoText}>
            Groq generiert Code. Gemini prüft Qualität (optional). Keys rotieren bei Fehlern automatisch.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const KeyList: React.FC<{
  keys: string[];
  provider: AllAIProviders;
  activeIndex: number;
  onRemove: (provider: AllAIProviders, key: string) => void;
}> = ({ keys, provider, activeIndex, onRemove }) => {
  if (keys.length === 0) {
    return (
      <View style={styles.emptyKeysContainer}>
        <Text style={styles.emptyKeysText}>Keine {provider.toUpperCase()} Keys gespeichert</Text>
      </View>
    );
  }

  return (
    <View style={styles.keysList}>
      {keys.map((key, index) => {
        const isActive = index === activeIndex;
        return (
          <View
            key={`${provider}-${index}`}
            style={[styles.keyItem, isActive && styles.keyItemActive]}
          >
            {isActive && (
              <Ionicons name="star" size={16} color={theme.palette.success} style={styles.starIcon} />
            )}
            <Text style={[styles.keyText, isActive && styles.keyTextActive]} numberOfLines={1}>
              #{index + 1}: {`${key.substring(0, 8)}...${key.substring(key.length - 4)}`}
            </Text>
            <TouchableOpacity onPress={() => onRemove(provider, key)} style={styles.deleteButton}>
              <Ionicons name="trash-outline" size={20} color={theme.palette.error} />
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.palette.background },
  container: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.palette.primary,
    marginTop: 25,
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    paddingBottom: 5,
  },
  subTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.palette.text.primary,
    marginTop: 15,
    marginBottom: 10,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginVertical: 10,
    paddingVertical: 10,
    backgroundColor: theme.palette.card,
    borderRadius: 8,
  },
  switchLabel: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    flexShrink: 1,
    textAlign: 'center',
  },
  modelContainer: { flexDirection: 'column', gap: 8 },
  modelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  modelButtonActive: {
    backgroundColor: theme.palette.primary,
    borderColor: theme.palette.primary,
  },
  modelButtonText: { fontSize: 14, color: theme.palette.text.primary },
  modelButtonTextActive: { color: theme.palette.background, fontWeight: 'bold' },
  activeKeyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.palette.card,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: theme.palette.success,
  },
  activeKeyText: {
    marginLeft: 8,
    fontSize: 13,
    color: theme.palette.success,
    fontWeight: 'bold',
  },
  addKeyContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 5 },
  keyInput: {
    flex: 1,
    backgroundColor: theme.palette.input.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    color: theme.palette.text.primary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  addButton: { padding: 4 },
  keysList: { marginTop: 12, gap: 8 },
  keyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.palette.card,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  keyItemActive: { borderColor: theme.palette.success, borderWidth: 2 },
  starIcon: { marginRight: 8 },
  keyText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: theme.palette.text.secondary,
  },
  keyTextActive: { color: theme.palette.success, fontWeight: 'bold' },
  deleteButton: { padding: 4 },
  emptyKeysContainer: {
    marginTop: 12,
    padding: 20,
    backgroundColor: theme.palette.card,
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyKeysText: { fontSize: 14, color: theme.palette.text.secondary },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 24,
    padding: 12,
    backgroundColor: theme.palette.card,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: theme.palette.primary,
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: theme.palette.text.secondary,
    lineHeight: 18,
  },
});

export default SettingsScreen;
