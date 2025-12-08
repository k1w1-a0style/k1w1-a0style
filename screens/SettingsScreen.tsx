// screens/SettingsScreen.tsx – Optimierter KI-Settings Screen
import React, { useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import {
  useAI,
  AllAIProviders,
  QualityMode,
  AVAILABLE_MODELS,
  PROVIDER_LABELS,
  PROVIDER_DESCRIPTIONS,
} from '../contexts/AIContext';

// Provider-Reihenfolge (Free-Tier zuerst)
const PROVIDER_ORDER: AllAIProviders[] = [
  'groq',
  'gemini',
  'google',
  'huggingface',
  'ollama',
  'openai',
  'anthropic',
  'openrouter',
  'deepseek',
  'xai',
];

// Provider-Icons
const PROVIDER_ICONS: Record<AllAIProviders, string> = {
  groq: 'flash-outline',
  gemini: 'diamond-outline',
  google: 'logo-google',
  openai: 'cube-outline',
  anthropic: 'sparkles-outline',
  huggingface: 'heart-outline',
  openrouter: 'git-network-outline',
  deepseek: 'search-outline',
  xai: 'planet-outline',
  ollama: 'server-outline',
};

// Memoized Provider Card
const ProviderCard = memo(({ 
  provider, 
  isActive, 
  onPress 
}: { 
  provider: AllAIProviders; 
  isActive: boolean; 
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={[styles.providerCard, isActive && styles.providerCardActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.providerCardIcon}>
      <Ionicons
        name={PROVIDER_ICONS[provider] as any}
        size={20}
        color={isActive ? theme.palette.primary : theme.palette.text.secondary}
      />
    </View>
    <Text style={[styles.providerCardTitle, isActive && styles.providerCardTitleActive]}>
      {PROVIDER_LABELS[provider]}
    </Text>
    <Text style={styles.providerCardSubtitle} numberOfLines={2}>
      {PROVIDER_DESCRIPTIONS[provider]}
    </Text>
  </TouchableOpacity>
));

ProviderCard.displayName = 'ProviderCard';

// Memoized Model Card
const ModelCard = memo(({ 
  model, 
  isActive, 
  onPress 
}: { 
  model: { id: string; label: string; description?: string; billing: string }; 
  isActive: boolean; 
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={[styles.modelItem, isActive && styles.modelItemActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.modelItemHeader}>
      <View style={styles.modelItemLeft}>
        <Ionicons
          name={isActive ? 'checkmark-circle' : 'ellipse-outline'}
          size={18}
          color={isActive ? theme.palette.primary : theme.palette.text.secondary}
        />
        <Text style={[styles.modelLabel, isActive && styles.modelLabelActive]}>
          {model.label}
        </Text>
      </View>
      <View style={[
        styles.billingBadge,
        model.billing === 'free' ? styles.billingFree : styles.billingPaid
      ]}>
        <Text style={styles.billingText}>
          {model.billing === 'free' ? 'FREE' : 'PAID'}
        </Text>
      </View>
    </View>
    {model.description && (
      <Text style={styles.modelDescription}>{model.description}</Text>
    )}
  </TouchableOpacity>
));

ModelCard.displayName = 'ModelCard';

// API Key Item
const ApiKeyItem = memo(({
  keyValue,
  index,
  provider,
  onPress,
  onLongPress,
}: {
  keyValue: string;
  index: number;
  provider: AllAIProviders;
  onPress: () => void;
  onLongPress: () => void;
}) => {
  const masked = keyValue.length <= 8 
    ? keyValue 
    : `${keyValue.slice(0, 6)}...${keyValue.slice(-4)}`;

  return (
    <TouchableOpacity
      style={styles.keyItem}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={styles.keyItemLeft}>
        {index === 0 && (
          <Ionicons name="star" size={14} color={theme.palette.warning} />
        )}
        <Text style={styles.keyText}>{masked}</Text>
      </View>
      <Ionicons name="trash-outline" size={16} color={theme.palette.text.muted} />
    </TouchableOpacity>
  );
});

ApiKeyItem.displayName = 'ApiKeyItem';

const SettingsScreen: React.FC = () => {
  const {
    config,
    isReady,
    addApiKey,
    removeApiKey,
    rotateApiKey,
    moveApiKeyToFront,
    setQualityMode,
    setSelectedChatProvider,
    setSelectedChatMode,
  } = useAI();

  const [tempKey, setTempKey] = useState('');
  const [selectedProviderForAdd, setSelectedProviderForAdd] = useState<AllAIProviders>('groq');
  const [expandedProvider, setExpandedProvider] = useState<AllAIProviders | null>(null);

  const isQualityMode = config.qualityMode === 'quality';

  const handleToggleQualityMode = useCallback(async (value: boolean) => {
    const mode: QualityMode = value ? 'quality' : 'speed';
    await setQualityMode(mode);
  }, [setQualityMode]);

  const handleAddKey = useCallback(async () => {
    const trimmed = tempKey.trim();
    if (!trimmed) {
      Alert.alert('Fehler', 'Bitte gib einen gültigen API-Key ein.');
      return;
    }
    await addApiKey(selectedProviderForAdd, trimmed);
    setTempKey('');
    Alert.alert('✅ Erfolg', `API-Key für ${PROVIDER_LABELS[selectedProviderForAdd]} hinzugefügt.`);
  }, [tempKey, selectedProviderForAdd, addApiKey]);

  const handleRemoveKey = useCallback((provider: AllAIProviders, key: string) => {
    const masked = key.length <= 8 ? key : `${key.slice(0, 4)}...${key.slice(-4)}`;
    Alert.alert(
      'API-Key entfernen',
      `Key "${masked}" für ${PROVIDER_LABELS[provider]} löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => removeApiKey(provider, key),
        },
      ],
    );
  }, [removeApiKey]);

  const handleRotateKeys = useCallback(async (provider: AllAIProviders) => {
    const ok = await rotateApiKey(provider);
    if (!ok) {
      Alert.alert('Info', 'Mindestens 2 Keys nötig zum Rotieren.');
    } else {
      Alert.alert('✅ Rotiert', 'Nächster Key wird nun verwendet.');
    }
  }, [rotateApiKey]);

  const handleSelectProvider = useCallback((provider: AllAIProviders) => {
    setSelectedChatProvider(provider);
    const fallbackModel = AVAILABLE_MODELS[provider]?.[0]?.id || `auto-${provider}`;
    setSelectedChatMode(fallbackModel);
  }, [setSelectedChatProvider, setSelectedChatMode]);

  const handleSelectModel = useCallback((modeId: string) => {
    setSelectedChatMode(modeId);
  }, [setSelectedChatMode]);

  const providerOptions = PROVIDER_ORDER.filter(
    (p) => (AVAILABLE_MODELS[p] || []).length > 0
  );

  const builderModels = AVAILABLE_MODELS[config.selectedChatProvider] ?? [];

  if (!isReady) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={theme.palette.primary} />
          <Text style={styles.loadingText}>Einstellungen werden geladen...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="settings-outline" size={28} color={theme.palette.primary} />
          </View>
          <Text style={styles.headerTitle}>KI-Einstellungen</Text>
          <Text style={styles.headerSubtitle}>
            Provider, Modelle & API-Keys verwalten
          </Text>
        </Animated.View>

        {/* Quality Mode Toggle */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="speedometer-outline" size={20} color={theme.palette.primary} />
            <Text style={styles.sectionTitle}>Modus</Text>
          </View>
          
          <View style={styles.modeCard}>
            <View style={styles.modeInfo}>
              <Text style={styles.modeTitle}>
                {isQualityMode ? '🎯 Quality-Modus' : '⚡ Speed-Modus'}
              </Text>
              <Text style={styles.modeDescription}>
                {isQualityMode 
                  ? 'Beste Ergebnisse, größere Modelle' 
                  : 'Schnelle Antworten, kleinere Modelle'}
              </Text>
            </View>
            <Switch
              value={isQualityMode}
              onValueChange={handleToggleQualityMode}
              trackColor={{ false: theme.palette.border, true: theme.palette.primary }}
              thumbColor="#fff"
            />
          </View>
        </Animated.View>

        {/* Provider Selection */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cube-outline" size={20} color={theme.palette.primary} />
            <Text style={styles.sectionTitle}>Provider</Text>
          </View>
          
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.providerScroll}
          >
            {providerOptions.map((provider) => (
              <ProviderCard
                key={provider}
                provider={provider}
                isActive={provider === config.selectedChatProvider}
                onPress={() => handleSelectProvider(provider)}
              />
            ))}
          </ScrollView>
        </Animated.View>

        {/* Model Selection */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="hardware-chip-outline" size={20} color={theme.palette.primary} />
            <Text style={styles.sectionTitle}>Modell</Text>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>
                {PROVIDER_LABELS[config.selectedChatProvider]}
              </Text>
            </View>
          </View>
          
          <View style={styles.modelList}>
            {builderModels.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                isActive={config.selectedChatMode === model.id}
                onPress={() => handleSelectModel(model.id)}
              />
            ))}
          </View>
        </Animated.View>

        {/* API Keys Section */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="key-outline" size={20} color={theme.palette.primary} />
            <Text style={styles.sectionTitle}>API-Keys</Text>
          </View>

          {/* Add Key Form */}
          <View style={styles.addKeyCard}>
            <Text style={styles.addKeyLabel}>Neuen Key hinzufügen:</Text>
            
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.providerPillScroll}
            >
              {PROVIDER_ORDER.map((provider) => (
                <TouchableOpacity
                  key={provider}
                  style={[
                    styles.providerPill,
                    selectedProviderForAdd === provider && styles.providerPillActive,
                  ]}
                  onPress={() => setSelectedProviderForAdd(provider)}
                >
                  <Text style={[
                    styles.providerPillText,
                    selectedProviderForAdd === provider && styles.providerPillTextActive,
                  ]}>
                    {PROVIDER_LABELS[provider]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.addKeyRow}>
              <TextInput
                style={styles.keyInput}
                placeholder="API-Key eingeben..."
                placeholderTextColor={theme.palette.text.muted}
                value={tempKey}
                onChangeText={setTempKey}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              <TouchableOpacity 
                style={[styles.addButton, !tempKey.trim() && styles.addButtonDisabled]} 
                onPress={handleAddKey}
                disabled={!tempKey.trim()}
              >
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Existing Keys */}
          <View style={styles.keysContainer}>
            {PROVIDER_ORDER.map((provider) => {
              const keys = config.apiKeys[provider] ?? [];
              if (keys.length === 0) return null;

              const isExpanded = expandedProvider === provider;

              return (
                <Animated.View 
                  key={provider} 
                  entering={FadeIn.duration(300)}
                  style={styles.providerKeysCard}
                >
                  <TouchableOpacity
                    style={styles.providerKeysHeader}
                    onPress={() => setExpandedProvider(isExpanded ? null : provider)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.providerKeysLeft}>
                      <Ionicons
                        name={PROVIDER_ICONS[provider] as any}
                        size={18}
                        color={theme.palette.primary}
                      />
                      <Text style={styles.providerKeysTitle}>
                        {PROVIDER_LABELS[provider]}
                      </Text>
                      <View style={styles.keyCountBadge}>
                        <Text style={styles.keyCountText}>{keys.length}</Text>
                      </View>
                    </View>
                    <View style={styles.providerKeysRight}>
                      {keys.length > 1 && (
                        <TouchableOpacity
                          style={styles.rotateButton}
                          onPress={() => handleRotateKeys(provider)}
                        >
                          <Ionicons name="sync-outline" size={16} color={theme.palette.text.primary} />
                        </TouchableOpacity>
                      )}
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={theme.palette.text.secondary}
                      />
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.keysList}>
                      {keys.map((key, index) => (
                        <ApiKeyItem
                          key={`${provider}-${index}`}
                          keyValue={key}
                          index={index}
                          provider={provider}
                          onPress={() => index > 0 && moveApiKeyToFront(provider, index)}
                          onLongPress={() => handleRemoveKey(provider, key)}
                        />
                      ))}
                      <Text style={styles.keyHint}>
                        Tippen = primär setzen • Lang drücken = löschen
                      </Text>
                    </View>
                  )}
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>

          <View style={styles.footer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Platform.OS === 'android' ? 80 : 40,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: theme.palette.text.secondary,
    fontSize: 15,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.palette.text.primary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.palette.text.secondary,
  },

  // Sections
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  sectionBadge: {
    backgroundColor: theme.palette.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.palette.primary,
  },

  // Mode Card
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.palette.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  modeInfo: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.palette.text.primary,
    marginBottom: 2,
  },
  modeDescription: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },

  // Provider Cards
  providerScroll: {
    paddingRight: 16,
    gap: 10,
  },
  providerCard: {
    width: 140,
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginRight: 10,
  },
  providerCardActive: {
    borderColor: theme.palette.primary,
    backgroundColor: theme.palette.primarySoft,
  },
  providerCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.palette.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  providerCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.palette.text.primary,
    marginBottom: 4,
  },
  providerCardTitleActive: {
    color: theme.palette.primary,
  },
  providerCardSubtitle: {
    fontSize: 10,
    color: theme.palette.text.secondary,
    lineHeight: 14,
  },

  // Model List
  modelList: {
    gap: 8,
  },
  modelItem: {
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  modelItemActive: {
    borderColor: theme.palette.primary,
    backgroundColor: theme.palette.primarySoft,
  },
  modelItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modelItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  modelLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.palette.text.primary,
  },
  modelLabelActive: {
    color: theme.palette.primary,
  },
  modelDescription: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 6,
    marginLeft: 26,
  },
  billingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  billingFree: {
    backgroundColor: 'rgba(0, 200, 83, 0.15)',
  },
  billingPaid: {
    backgroundColor: 'rgba(255, 170, 0, 0.15)',
  },
  billingText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.palette.text.primary,
  },

  // Add Key Card
  addKeyCard: {
    backgroundColor: theme.palette.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginBottom: 16,
  },
  addKeyLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.palette.text.secondary,
    marginBottom: 12,
  },
  providerPillScroll: {
    marginBottom: 12,
  },
  providerPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.palette.background,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginRight: 8,
  },
  providerPillActive: {
    backgroundColor: theme.palette.primary,
    borderColor: theme.palette.primary,
  },
  providerPillText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  providerPillTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  addKeyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  keyInput: {
    flex: 1,
    backgroundColor: theme.palette.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.palette.text.primary,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: theme.palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },

  // Keys Container
  keysContainer: {
    gap: 10,
  },
  providerKeysCard: {
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
    overflow: 'hidden',
  },
  providerKeysHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  providerKeysLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  providerKeysTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  keyCountBadge: {
    backgroundColor: theme.palette.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  keyCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.palette.primary,
  },
  providerKeysRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rotateButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: theme.palette.background,
  },
  keysList: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  keyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.palette.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  keyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  keyText: {
    fontSize: 13,
    color: theme.palette.text.primary,
    fontFamily: 'monospace',
  },
  keyHint: {
    fontSize: 11,
    color: theme.palette.text.muted,
    textAlign: 'center',
    marginTop: 6,
  },

  footer: {
    height: 40,
  },
});

export default SettingsScreen;
