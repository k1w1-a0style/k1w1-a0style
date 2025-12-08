// screens/SettingsScreen.tsx – KI-Provider & API-Keys (Best-of, ohne surfaceHover)

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  TextInput,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
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

// Feste Liste bekannter Provider – muss zu AIContext passen
const PROVIDER_ORDER: AllAIProviders[] = [
  'groq',
  'gemini',
  'google',
  'openai',
  'anthropic',
  'huggingface',
  'openrouter',
  'deepseek',
  'xai',
  'ollama',
];

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
  const [selectedProviderForAdd, setSelectedProviderForAdd] =
    useState<AllAIProviders>('groq');

  const isQualityMode = config.qualityMode === 'quality';

  const maskApiKey = (key: string): string => {
    if (key.length <= 8) return key;
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  };

  const handleToggleQualityMode = async (value: boolean) => {
    const mode: QualityMode = value ? 'quality' : 'speed';
    await setQualityMode(mode);
  };

  const handleAddKey = async () => {
    const trimmed = tempKey.trim();
    if (!trimmed) {
      Alert.alert('Fehler', 'Bitte gib einen gültigen API-Key ein.');
      return;
    }
    await addApiKey(selectedProviderForAdd, trimmed);
    setTempKey('');
  };

  const handleRemoveKey = async (provider: AllAIProviders, key: string) => {
    Alert.alert(
      'API-Key entfernen',
      `Möchtest du den Key "${maskApiKey(
        key,
      )}" für ${provider.toUpperCase()} wirklich entfernen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen',
          style: 'destructive',
          onPress: async () => {
            await removeApiKey(provider, key);
          },
        },
      ],
    );
  };

  const handleRotateKeys = async (provider: AllAIProviders) => {
    const ok = await rotateApiKey(provider);
    if (!ok) {
      Alert.alert(
        'Rotation nicht möglich',
        `Für ${provider.toUpperCase()} sind nicht genug Keys hinterlegt.`,
      );
    } else {
      Alert.alert(
        'Keys rotiert',
        `Der nächste Key in der Liste für ${provider.toUpperCase()} wird nun verwendet.`,
      );
    }
  };

  const handleMoveToFront = async (
    provider: AllAIProviders,
    index: number,
  ) => {
    await moveApiKeyToFront(provider, index);
  };

  const providerOptions: AllAIProviders[] = PROVIDER_ORDER.filter(
    (provider) => (AVAILABLE_MODELS[provider] || []).length > 0,
  );

  const builderModels =
    AVAILABLE_MODELS[config.selectedChatProvider] ?? [];

  const providersToRender: AllAIProviders[] = [...PROVIDER_ORDER];

  const handleSelectProvider = (provider: AllAIProviders) => {
    setSelectedChatProvider(provider);
    const fallbackModel =
      AVAILABLE_MODELS[provider]?.[0]?.id || `auto-${provider}`;
    setSelectedChatMode(fallbackModel);
  };

  const handleSelectModel = (modeId: string) => {
    setSelectedChatMode(modeId);
  };

  if (!isReady) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={['bottom', 'left', 'right']}
      >
        <View style={styles.loadingState}>
          <ActivityIndicator size="small" color={theme.palette.primary} />
          <Text style={styles.loadingText}>
            KI-Einstellungen werden geladen ...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <Animated.View
          entering={FadeInDown.duration(400).springify()}
          style={styles.headerRow}
        >
          <View>
            <Text style={styles.title}>KI-Einstellungen</Text>
            <Text style={styles.subtitle}>
              Verwalte Provider, Modelle & API-Keys für deinen Builder.
            </Text>
          </View>
          {Platform.OS !== 'android' && (
            <Ionicons
              name="settings-outline"
              size={26}
              color={theme.palette.text.secondary}
            />
          )}
        </Animated.View>

        {/* Quality / Speed Toggle */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(500).springify()}
          style={styles.card}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Modus</Text>
            <View style={styles.modeRow}>
              <Text style={styles.modeLabel}>
                {isQualityMode ? 'Quality' : 'Speed'}
              </Text>
              <Switch
                value={isQualityMode}
                onValueChange={handleToggleQualityMode}
                trackColor={{
                  false: theme.palette.border,
                  true: theme.palette.primary,
                }}
                thumbColor={theme.palette.background}
              />
            </View>
          </View>
          <Text style={styles.cardDescription}>
            Quality: bessere Ergebnisse, etwas langsamer. Speed: schneller,
            günstiger.
          </Text>
        </Animated.View>

        {/* Provider & Model Auswahl */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(500).springify()}
          style={styles.card}
        >
          <Text style={styles.cardTitle}>Builder Provider & Modell</Text>
          <Text style={styles.cardDescription}>
            Wähle den Standard-Provider und das Modell, das der Builder nutzen
            soll.
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.providerSelectRow}
          >
            {providerOptions.map((provider) => {
              const isActive = provider === config.selectedChatProvider;
              return (
                <TouchableOpacity
                  key={provider}
                  style={[
                    styles.providerSelectCard,
                    isActive && styles.providerSelectCardActive,
                  ]}
                  onPress={() => handleSelectProvider(provider)}
                >
                  <Text
                    style={[
                      styles.providerSelectCardTitle,
                      isActive && styles.providerSelectCardTitleActive,
                    ]}
                  >
                    {PROVIDER_LABELS[provider] || provider.toUpperCase()}
                  </Text>
                  <Text style={styles.providerSelectCardSubtitle}>
                    {PROVIDER_DESCRIPTIONS[provider]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.modelList}>
            {builderModels.map((model) => {
              const isActive = config.selectedChatMode === model.id;
              return (
                <TouchableOpacity
                  key={model.id}
                  style={[
                    styles.modelCard,
                    isActive && styles.modelCardActive,
                  ]}
                  onPress={() => handleSelectModel(model.id)}
                >
                  <View style={styles.modelCardHeader}>
                    <Text
                      style={[
                        styles.modelLabel,
                        isActive && styles.modelLabelActive,
                      ]}
                    >
                      {model.label}
                    </Text>
                    <View
                      style={[
                        styles.modelBadge,
                        model.billing === 'free'
                          ? styles.modelBadgeFree
                          : styles.modelBadgePaid,
                      ]}
                    >
                      <Text style={styles.modelBadgeText}>
                        {model.billing === 'free' ? 'FREE' : 'PRO'}
                      </Text>
                    </View>
                  </View>
                  {model.description ? (
                    <Text style={styles.modelDescription}>
                      {model.description}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* Provider & Keys */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(500).springify()}
          style={styles.sectionHeaderRow}
        >
          <Text style={styles.sectionTitle}>API-Keys je Provider</Text>
          <Text style={styles.sectionSubtitle}>
            Lang-press zum Entfernen oder als primär setzen.
          </Text>
        </Animated.View>

        {providersToRender.map((provider, index) => {
          const keys: string[] = config.apiKeys[provider] || [];
          const hasKeys = keys.length > 0;

          return (
            <Animated.View
              key={provider}
              entering={FadeInDown.delay(400 + index * 50)
                .duration(500)
                .springify()}
              style={styles.card}
            >
              <View style={styles.providerHeader}>
                <View style={styles.providerTitleRow}>
                  <Text style={styles.providerName}>
                    {provider.toUpperCase()}
                  </Text>
                  {hasKeys && (
                    <View style={styles.keyCountBadge}>
                      <Text style={styles.keyCountText}>
                        {keys.length} Key
                        {keys.length > 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                </View>

                {hasKeys && (
                  <TouchableOpacity
                    style={styles.rotateButton}
                    onPress={() => handleRotateKeys(provider)}
                  >
                    <Ionicons
                      name="sync-outline"
                      size={16}
                      color={theme.palette.text.primary}
                    />
                    <Text style={styles.rotateButtonText}>Keys rotieren</Text>
                  </TouchableOpacity>
                )}
              </View>

              {!hasKeys ? (
                <Text style={styles.noKeysText}>
                  Noch keine Keys für {provider.toUpperCase()} hinterlegt.
                </Text>
              ) : (
                <View style={styles.keyList}>
                  {keys.map((key, index) => (
                    <View
                      key={`${provider}-${index}-${key.slice(0, 4)}`}
                      style={styles.keyRow}
                    >
                      <TouchableOpacity
                        style={styles.keyTextWrapper}
                        onLongPress={() =>
                          handleRemoveKey(provider, key)
                        }
                        onPress={() => handleMoveToFront(provider, index)}
                      >
                        <Text style={styles.keyMaskedText}>
                          {index === 0 ? '⭐ ' : ''}
                          {maskApiKey(key)}
                        </Text>
                        <Text style={styles.keyHintText}>
                          Tippen = als primär setzen • Lang-press = löschen
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </Animated.View>
          );
        })}

        {/* Key hinzufügen */}
        <Animated.View
          entering={FadeInDown.delay(800).duration(500).springify()}
          style={styles.card}
        >
          <Text style={styles.cardTitle}>API-Key hinzufügen</Text>
          <Text style={styles.cardDescription}>
            Wähle einen Provider und füge einen neuen API-Key hinzu.
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.providerPillRow}
          >
            {PROVIDER_ORDER.map((provider) => (
              <TouchableOpacity
                key={provider}
                style={[
                  styles.providerPill,
                  selectedProviderForAdd === provider &&
                    styles.providerPillActive,
                ]}
                onPress={() => setSelectedProviderForAdd(provider)}
              >
                <Text
                  style={[
                    styles.providerPillText,
                    selectedProviderForAdd === provider &&
                      styles.providerPillTextActive,
                  ]}
                >
                  {provider.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.addRow}>
            <TextInput
              style={styles.keyInput}
              placeholder="Neuer API-Key"
              placeholderTextColor={theme.palette.text.secondary}
              value={tempKey}
              onChangeText={setTempKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddKey}
            >
              <Ionicons
                name="add"
                size={20}
                color={theme.palette.background}
              />
            </TouchableOpacity>
          </View>
        </Animated.View>

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.palette.text.primary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: theme.palette.text.secondary,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: theme.palette.text.secondary,
    fontSize: 14,
  },

  card: {
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  cardDescription: {
    marginTop: 6,
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  providerSelectRow: {
    marginTop: 12,
  },
  providerSelectCard: {
    width: 220,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.background,
    marginRight: 12,
  },
  providerSelectCardActive: {
    borderColor: theme.palette.primary,
    backgroundColor: `${theme.palette.primary}11`,
  },
  providerSelectCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.palette.text.primary,
    marginBottom: 6,
  },
  providerSelectCardTitleActive: {
    color: theme.palette.primary,
  },
  providerSelectCardSubtitle: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeLabel: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    marginRight: 8,
  },

  sectionHeaderRow: {
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: theme.palette.text.secondary,
  },

  providerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  providerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  providerName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  keyCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: theme.palette.badge.defaultBg,
  },
  keyCountText: {
    fontSize: 11,
    color: theme.palette.badge.defaultText,
  },
  rotateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  rotateButtonText: {
    marginLeft: 6,
    fontSize: 11,
    color: theme.palette.text.primary,
  },

  noKeysText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 4,
  },

  keyList: {
    marginTop: 8,
  },
  keyRow: {
    marginBottom: 8,
  },
  keyTextWrapper: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.palette.background,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  keyMaskedText: {
    fontSize: 13,
    color: theme.palette.text.primary,
  },
  keyHintText: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    marginTop: 2,
  },

  providerPillRow: {
    marginTop: 10,
    marginBottom: 8,
  },
  providerPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
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
    color: theme.palette.background,
    fontWeight: '600',
  },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  keyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: theme.palette.text.primary,
    fontSize: 13,
  },
  addButton: {
    marginLeft: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.palette.primary,
  },

  spacer: {
    height: 32,
  },
  modelList: {
    marginTop: 12,
  },
  modelCard: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: theme.palette.background,
  },
  modelCardActive: {
    borderColor: theme.palette.primary,
    backgroundColor: `${theme.palette.primary}0D`,
  },
  modelCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modelLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  modelLabelActive: {
    color: theme.palette.primary,
  },
  modelDescription: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  modelBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  modelBadgeFree: {
    backgroundColor: 'rgba(72, 199, 116, 0.15)',
  },
  modelBadgePaid: {
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
  },
  modelBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
});

export default SettingsScreen;
