import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../theme';
import { useAI } from '../contexts/AIContext';
import type {
  AllAIProviders,
  ModelInfo,
  ModelTier,
  ProviderLimitStatus,
  QualityMode,
} from '../contexts/AIContext';
import { AVAILABLE_MODELS, PROVIDER_METADATA } from '../contexts/AIContext';

const PROVIDER_IDS: AllAIProviders[] = ['groq', 'gemini', 'openai', 'anthropic', 'huggingface'];

const tierTokens: Record<ModelTier, { label: string; bg: string; color: string }> = {
  free: { label: 'Free', bg: '#0f9d580f', color: '#0f9d58' },
  credit: { label: 'Quota', bg: '#1a73e80f', color: '#1a73e8' },
  paid: { label: 'Paid', bg: '#ea43350f', color: '#ea4335' },
};

const personaTokens = {
  speed: { label: '⚡ Speed', color: '#ff8c37' },
  quality: { label: '💎 Qualität', color: '#7c4dff' },
  balanced: { label: '⚖️ Balance', color: '#5e8bff' },
  review: { label: '🔍 Review', color: '#ff5c8d' },
};

type ProviderId = AllAIProviders;

type ModeListProps = {
  provider: ProviderId;
  selectedMode: string;
  onSelect: (modeId: string) => void;
  highlightPersona: 'speed' | 'quality';
};

const ModeList: React.FC<ModeListProps> = ({ provider, selectedMode, onSelect, highlightPersona }) => {
  const modes = AVAILABLE_MODELS[provider] || [];

  if (modes.length === 0) {
    return (
      <Text style={styles.emptyText}>
        Für diesen Provider sind noch keine Modelle definiert.
      </Text>
    );
  }

  return (
    <View style={styles.modelList}>
      {modes.map((model: ModelInfo) => {
        const isSelected = model.id === selectedMode;
        const persona = personaTokens[model.persona];
        const tier = tierTokens[model.tier];
        const highlighted = model.persona === highlightPersona;

        return (
          <TouchableOpacity
            key={model.id}
            style={[
              styles.modelRow,
              isSelected && styles.modelRowActive,
              highlighted && !isSelected && styles.modelRowPersona,
            ]}
            onPress={() => onSelect(model.id)}
          >
            <View style={styles.modelHeader}>
              <View>
                <Text style={[styles.modelLabel, isSelected && styles.modelLabelActive]}>
                  {model.label}
                </Text>
                <Text style={styles.modelId}>{model.id}</Text>
              </View>
              <View style={styles.badgeColumn}>
                <View style={[styles.badge, { backgroundColor: tier.bg }]}> 
                  <Text style={[styles.badgeText, { color: tier.color }]}>{tier.label}</Text>
                </View>
                <View style={[styles.badge, styles.personaBadge]}> 
                  <Text style={[styles.badgeText, { color: persona.color }]}>{persona.label}</Text>
                </View>
                {model.isAuto && (
                  <View style={[styles.badge, styles.autoBadge]}>
                    <Text style={styles.badgeText}>Auto</Text>
                  </View>
                )}
              </View>
            </View>

            <Text style={styles.modelDescription}>{model.description}</Text>
            <Text style={styles.modelBestFor}>{model.bestFor}</Text>
            {model.contextWindow && (
              <Text style={styles.modelContext}>
                Kontext: {model.contextWindow}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const SettingsScreen: React.FC = () => {
  const {
    config,
    setSelectedChatProvider,
    setSelectedAgentProvider,
    setSelectedChatMode,
    setSelectedAgentMode,
    setQualityMode,
    addApiKey,
    removeApiKey,
    rotateApiKey,
    moveApiKeyToFront,
    providerStatus,
    acknowledgeProviderStatus,
  } = useAI();

  const [newKey, setNewKey] = useState('');
  const [selectedKeyProvider, setSelectedKeyProvider] = useState<ProviderId>('groq');

  const generatorProvider = config.selectedChatProvider as ProviderId;
  const agentProvider = config.selectedAgentProvider as ProviderId;

  const isQualityMode = config.qualityMode === 'quality';

  const allKeys = config.apiKeys[selectedKeyProvider] || [];
  const hasMultipleKeys = allKeys.length > 1;
  const limitStatus: ProviderLimitStatus =
    providerStatus[selectedKeyProvider] ?? { limitReached: false };

  const generatorHighlightPersona = isQualityMode ? 'quality' : 'speed';
  const agentHighlightPersona: 'speed' | 'quality' = 'quality';

  const limitInfo = useMemo(() => {
    if (!limitStatus?.limitReached) {
      return 'Alles grün – aktueller Key liefert noch freie Tokens.';
    }
    const ts = limitStatus.lastRotation
      ? new Date(limitStatus.lastRotation).toLocaleTimeString()
      : 'gerade eben';
    return `Limit erreicht (Free/Quota). Automatisch rotiert um ${ts}.`;
  }, [limitStatus]);

  const handleSetQuality = (mode: QualityMode) => {
    setQualityMode(mode);
  };

  const handleAddKey = async () => {
    const trimmed = newKey.trim();
    if (!trimmed) {
      Alert.alert('Fehler', 'Bitte gib einen gültigen API-Key ein.');
      return;
    }
    try {
      await addApiKey(selectedKeyProvider, trimmed);
      setNewKey('');
      Alert.alert('✅ Gespeichert', 'Der neue API-Key ist jetzt aktiv.');
    } catch (error: any) {
      Alert.alert('Fehler', error?.message || 'Key konnte nicht gespeichert werden.');
    }
  };

  const handleRemoveKey = async (key: string) => {
    Alert.alert(
      'Key löschen?',
      `Möchtest du den Key ${key.slice(0, 8)}... dauerhaft löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeApiKey(selectedKeyProvider, key);
              Alert.alert('🗑️ Entfernt', 'Key wurde gelöscht.');
            } catch (error: any) {
              Alert.alert('Fehler', error?.message || 'Key konnte nicht gelöscht werden.');
            }
          },
        },
      ],
    );
  };

  const handleActivateKey = async (index: number) => {
    try {
      await moveApiKeyToFront(selectedKeyProvider, index);
      Alert.alert('✅ Aktiviert', 'Dieser Key ist jetzt aktiv.');
    } catch (error: any) {
      Alert.alert('Fehler', error?.message || 'Key konnte nicht aktiviert werden.');
    }
  };

  const handleRotateKeys = async () => {
    if (!hasMultipleKeys) {
      Alert.alert('Keine Rotation möglich', 'Mindestens zwei Keys sind notwendig.');
      return;
    }

    Alert.alert(
      'Keys rotieren?',
      'Der aktuelle Key wird ans Ende verschoben, der nächste wird aktiv.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Rotieren',
          onPress: async () => {
            try {
              await rotateApiKey(selectedKeyProvider);
              Alert.alert('🔄 Rotiert', 'Keys wurden rotiert.');
            } catch (error: any) {
              Alert.alert('Fehler', error?.message || 'Rotation fehlgeschlagen.');
            }
          },
        },
      ],
    );
  };

  const renderProviderTiles = (
    selectedProvider: ProviderId,
    onSelect: (provider: ProviderId) => void,
  ) => (
    <View>
      {PROVIDER_IDS.map((id) => {
        const meta = PROVIDER_METADATA[id];
        const status = providerStatus[id];
        const keyCount = config.apiKeys[id]?.length || 0;
        const isSelected = id === selectedProvider;
        const lampStyle = status.limitReached
          ? styles.statusLampAlert
          : keyCount > 0
          ? styles.statusLampOk
          : styles.statusLampIdle;

        return (
          <TouchableOpacity
            key={id}
            style={[styles.providerTile, isSelected && styles.providerTileActive]}
            onPress={() => onSelect(id)}
          >
            <View style={styles.providerLampWrapper}>
              <View style={[styles.statusLamp, lampStyle]} />
            </View>
            <View style={styles.providerTileText}>
              <Text style={styles.providerTileTitle}>
                {meta.emoji} {meta.label}
              </Text>
              <Text style={styles.providerTileHero}>{meta.hero}</Text>
              <Text style={styles.providerTileDesc}>{meta.description}</Text>
              <Text style={styles.providerTileKeys}>
                {keyCount > 0 ? `${keyCount} Key(s) hinterlegt` : 'Noch keine Keys gespeichert'}
              </Text>
              {status.limitReached && (
                <View style={styles.providerTileWarningRow}>
                  <Text style={styles.providerTileWarning}>Limit erreicht – automatische Rotation aktiv.</Text>
                  <TouchableOpacity
                    onPress={() => acknowledgeProviderStatus(id)}
                    style={styles.lampResetButton}
                  >
                    <Text style={styles.lampResetText}>Lampe zurücksetzen</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderApiKeyList = () => {
    if (allKeys.length === 0) {
      return (
        <View style={styles.emptyKeyState}>
          <Text style={styles.emptyKeyText}>
            🔑 Noch keine API-Keys für {PROVIDER_METADATA[selectedKeyProvider].label} hinterlegt
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.keyListContainer}>
        <View style={styles.keyListHeader}>
          <Text style={styles.keyListTitle}>Gespeicherte Keys ({allKeys.length})</Text>
          {hasMultipleKeys && (
            <TouchableOpacity onPress={handleRotateKeys} style={styles.rotateButton}>
              <Ionicons name="sync-outline" size={16} color={theme.palette.primary} />
              <Text style={styles.rotateButtonText}>Rotieren</Text>
            </TouchableOpacity>
          )}
        </View>

        {allKeys.map((key, index) => {
          const isActive = index === 0;
          const masked = key.slice(0, 8) + '...' + key.slice(-4);

          return (
            <View key={key} style={[styles.keyRow, isActive && styles.keyRowActive]}>
              <View style={styles.keyInfo}>
                {isActive && <Ionicons name="star" size={14} color={theme.palette.success} />}
                <Text style={[styles.keyText, isActive && styles.keyTextActive]}>{masked}</Text>
                {isActive && <Text style={styles.activeLabel}>AKTIV</Text>}
              </View>
              <View style={styles.keyActions}>
                {!isActive && (
                  <TouchableOpacity onPress={() => handleActivateKey(index)} style={styles.iconButton}>
                    <Ionicons name="arrow-up-circle-outline" size={20} color={theme.palette.primary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleRemoveKey(key)} style={styles.iconButton}>
                  <Ionicons name="trash-outline" size={20} color={theme.palette.error} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        <Text style={styles.keyListHint}>
          💡 Der oberste Key ist aktiv. Bei Rate-Limits / 401 rotiert die App automatisch.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.screenTitle}>⚙️ KI-Einstellungen</Text>
        <Text style={styles.screenSubtitle}>
          Wähle Provider, Modelle und verwalte deine API-Keys. Alle Texte & Prompts laufen komplett auf Deutsch.
        </Text>

        <View style={styles.heroRow}>
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>⚖️ Qualitätsmodus</Text>
            <Text style={styles.heroSubtitle}>
              Schalte zwischen Geschwindigkeit (direkte Umsetzung) und Qualität (Validator mit Review-Flow) um.
            </Text>
            <View style={styles.modeToggleRow}>
              <TouchableOpacity
                style={[styles.modeToggle, !isQualityMode && styles.modeToggleActive]}
                onPress={() => handleSetQuality('speed')}
              >
                <Text style={[styles.modeToggleText, !isQualityMode && styles.modeToggleTextActive]}>⚡ Speed</Text>
                <Text style={styles.modeToggleHint}>Günstig & schnell</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeToggle, isQualityMode && styles.modeToggleActive]}
                onPress={() => handleSetQuality('quality')}
              >
                <Text style={[styles.modeToggleText, isQualityMode && styles.modeToggleTextActive]}>💎 Qualität</Text>
                <Text style={styles.modeToggleHint}>Validator aktiv</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.heroCardSecondary}>
            <Text style={styles.heroTitle}>🔄 Key-Rotation</Text>
            <Text style={styles.heroSubtitle}>
              {limitInfo}
            </Text>
            <View style={styles.heroBulletRow}>
              <Ionicons name="shield-checkmark" size={16} color={theme.palette.primary} />
              <Text style={styles.heroBulletText}>Auto-Rotation nach 401/429 (max. 3 Versuche)</Text>
            </View>
            <View style={styles.heroBulletRow}>
              <Ionicons name="alert-circle" size={16} color={theme.palette.secondary} />
              <Text style={styles.heroBulletText}>Lampe zeigt erschöpftes Free/Quota an</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🛠️ Generator (Code-Erzeugung)</Text>
          <Text style={styles.sectionSubtitle}>
            Diese KI schreibt Code, berücksichtigt Project-History und hält sich an echte Pfade.
          </Text>
          {renderProviderTiles(generatorProvider, setSelectedChatProvider)}
          <ModeList
            provider={generatorProvider}
            selectedMode={config.selectedChatMode}
            onSelect={setSelectedChatMode}
            highlightPersona={generatorHighlightPersona}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💎 Quality-Agent (Validator)</Text>
          <Text style={styles.sectionSubtitle}>
            Prüft Antworten, korrigiert Pfade, validiert JSON und verhindert Platzhalter.
          </Text>
          {renderProviderTiles(agentProvider, setSelectedAgentProvider)}
          <ModeList
            provider={agentProvider}
            selectedMode={config.selectedAgentMode}
            onSelect={setSelectedAgentMode}
            highlightPersona={agentHighlightPersona}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔑 API-Keys & Rotation</Text>
          <Text style={styles.sectionSubtitle}>
            Hinterlege mehrere Keys pro Anbieter. Die App merkt sich Fehler, rotiert automatisch und zeigt Limits über die Lampe an.
          </Text>

          <Text style={styles.subheading}>Provider auswählen</Text>
          <View style={styles.keyProviderRow}>
            {PROVIDER_IDS.map((id) => {
              const isActive = id === selectedKeyProvider;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.keyProviderChip, isActive && styles.keyProviderChipActive]}
                  onPress={() => setSelectedKeyProvider(id)}
                >
                  <Text style={[styles.keyProviderChipText, isActive && styles.keyProviderChipTextActive]}>
                    {PROVIDER_METADATA[id].emoji} {PROVIDER_METADATA[id].label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.limitCallout}>
            <View style={[styles.statusLamp, limitStatus.limitReached ? styles.statusLampAlert : styles.statusLampOk]} />
            <View style={styles.limitCalloutText}>
              <Text style={styles.limitCalloutTitle}>Status</Text>
              <Text style={styles.limitCalloutBody}>{limitInfo}</Text>
            </View>
            {limitStatus.limitReached && (
              <TouchableOpacity
                style={styles.lampResetButtonOutline}
                onPress={() => acknowledgeProviderStatus(selectedKeyProvider)}
              >
                <Text style={styles.lampResetText}>Lampe zurücksetzen</Text>
              </TouchableOpacity>
            )}
          </View>

          {renderApiKeyList()}

          <View style={styles.addKeySection}>
            <Text style={styles.subheading}>Neuen Key hinzufügen</Text>
            <TextInput
              style={styles.input}
              value={newKey}
              onChangeText={setNewKey}
              placeholder="API-Key hier einfügen ..."
              placeholderTextColor={theme.palette.text.secondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleAddKey}>
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.saveButtonText}>Key hinzufügen</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.hintText}>
            💡 Keys werden lokal verschlüsselt gespeichert. Bei Limit-Fehlern erfolgt das Rotieren automatisch.
          </Text>
        </View>
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
    backgroundColor: theme.palette.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 48,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    color: theme.palette.text.primary,
  },
  screenSubtitle: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    marginBottom: 20,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  heroCard: {
    flex: 1,
    minWidth: 250,
    backgroundColor: theme.palette.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.palette.primary + '30',
  },
  heroCardSecondary: {
    flex: 1,
    minWidth: 250,
    backgroundColor: theme.palette.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.palette.text.primary,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  heroBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  heroBulletText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeToggle: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  modeToggleActive: {
    backgroundColor: theme.palette.primary,
    borderColor: theme.palette.primary,
  },
  modeToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.palette.text.secondary,
  },
  modeToggleTextActive: {
    color: '#fff',
  },
  modeToggleHint: {
    fontSize: 10,
    color: theme.palette.text.secondary,
  },
  section: {
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.palette.text.primary,
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    marginBottom: 14,
    lineHeight: 18,
  },
  subheading: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '600',
    color: theme.palette.text.secondary,
  },
  providerTile: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginBottom: 10,
    backgroundColor: theme.palette.background,
  },
  providerTileActive: {
    borderColor: theme.palette.primary,
    backgroundColor: theme.palette.primary + '0D',
  },
  providerLampWrapper: {
    marginRight: 12,
    justifyContent: 'center',
  },
  statusLamp: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#00000020',
  },
  statusLampOk: {
    backgroundColor: '#34a853',
  },
  statusLampAlert: {
    backgroundColor: '#ea4335',
  },
  statusLampIdle: {
    backgroundColor: '#bdc1c6',
  },
  providerTileText: {
    flex: 1,
  },
  providerTileTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  providerTileHero: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  providerTileDesc: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 4,
    lineHeight: 16,
  },
  providerTileKeys: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 4,
  },
  providerTileWarningRow: {
    marginTop: 6,
  },
  providerTileWarning: {
    fontSize: 12,
    color: theme.palette.error,
  },
  lampResetButton: {
    marginTop: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.palette.error,
  },
  lampResetButtonOutline: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
    alignSelf: 'center',
  },
  lampResetText: {
    fontSize: 11,
    color: theme.palette.text.primary,
    fontWeight: '600',
  },
  modelList: {
    marginTop: 10,
  },
  modelRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
    padding: 14,
    marginBottom: 10,
    backgroundColor: theme.palette.background,
  },
  modelRowActive: {
    borderColor: theme.palette.primary,
    borderWidth: 2,
    backgroundColor: theme.palette.primary + '10',
  },
  modelRowPersona: {
    borderColor: theme.palette.secondary,
  },
  modelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modelLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  modelLabelActive: {
    color: theme.palette.primary,
  },
  modelId: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modelDescription: {
    fontSize: 13,
    color: theme.palette.text.primary,
    lineHeight: 18,
  },
  modelBestFor: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 6,
  },
  modelContext: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  badgeColumn: {
    alignItems: 'flex-end',
    gap: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  personaBadge: {
    backgroundColor: '#0000000d',
  },
  autoBadge: {
    backgroundColor: theme.palette.primary + '20',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  emptyText: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
  },
  keyProviderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  keyProviderChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  keyProviderChipActive: {
    backgroundColor: theme.palette.primary,
    borderColor: theme.palette.primary,
  },
  keyProviderChipText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  keyProviderChipTextActive: {
    color: '#fff',
  },
  limitCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 12,
    padding: 12,
    gap: 12,
    marginBottom: 12,
    backgroundColor: theme.palette.background,
  },
  limitCalloutText: {
    flex: 1,
  },
  limitCalloutTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  limitCalloutBody: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  keyListContainer: {
    marginBottom: 16,
  },
  keyListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  keyListTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  rotateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  rotateButtonText: {
    marginLeft: 4,
    fontSize: 12,
    color: theme.palette.primary,
    fontWeight: '600',
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.background,
    marginBottom: 6,
  },
  keyRowActive: {
    borderColor: theme.palette.success,
    borderWidth: 2,
    backgroundColor: theme.palette.success + '10',
  },
  keyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  keyText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: theme.palette.text.secondary,
  },
  keyTextActive: {
    color: theme.palette.success,
    fontWeight: '600',
  },
  activeLabel: {
    fontSize: 10,
    color: theme.palette.success,
    fontWeight: '700',
    backgroundColor: theme.palette.success + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  keyActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 4,
  },
  keyListHint: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    marginTop: 8,
    lineHeight: 14,
    fontStyle: 'italic',
  },
  emptyKeyState: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderStyle: 'dashed',
    marginTop: 12,
    marginBottom: 16,
  },
  emptyKeyText: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    textAlign: 'center',
  },
  addKeySection: {
    marginTop: 12,
  },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.palette.primary,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  hintText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 10,
    lineHeight: 16,
  },
});

export default SettingsScreen;
