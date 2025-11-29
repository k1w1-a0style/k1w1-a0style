// screens/SettingsScreen.tsx - MIT MULTI-KEY SUPPORT & KORREKTEN MODELLEN
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAI } from '../contexts/AIContext';

type ProviderId = 'groq' | 'gemini' | 'openai' | 'anthropic' | 'huggingface';

const PROVIDER_LABELS: Record<ProviderId, string> = {
  groq: '⚙️ Groq',
  gemini: '🤖 Gemini',
  openai: '🧠 OpenAI',
  anthropic: '🧩 Anthropic',
  huggingface: '📦 HuggingFace',
};

const PROVIDER_DESCRIPTIONS: Record<ProviderId, string> = {
  groq: 'Sehr schnell & günstig, ideal für Coding. Beste Wahl für Builder.',
  gemini: 'Gute Code-Qualität, großer Kontext. Ideal als Quality Agent.',
  openai: 'Starke Modelle, aber kostenpflichtig. Sehr gute Code-Qualität.',
  anthropic: 'Claude: Sehr sauberer, gut kommentierter Code. Top für Reviews.',
  huggingface: 'Open-Source-Modelle, kostenlos. Gut für Experimente & Tests.',
};

const AVAILABLE_MODES: Record<ProviderId, { id: string; label: string; description?: string }[]> = {
  groq: [
    {
      id: 'auto-groq',
      label: '🎯 Auto (empfohlen)',
      description: 'Wählt automatisch das beste Modell basierend auf Quality-Mode',
    },
    {
      id: 'llama-3.3-70b-versatile',
      label: 'LLaMA 3.3 70B Versatile',
      description: 'Sehr gutes Allround-Modell, stark bei komplexen Aufgaben',
    },
    {
      id: 'llama-3.1-8b-instant',
      label: 'LLaMA 3.1 8B Instant',
      description: 'Extrem schnell, günstig, gut für einfache Tasks',
    },
    {
      id: 'openai/gpt-oss-120b',
      label: 'GPT OSS 120B',
      description: 'Sehr starkes Open-Source-Modell, höchste Qualität',
    },
    {
      id: 'openai/gpt-oss-20b',
      label: 'GPT OSS 20B',
      description: 'Gute Balance zwischen Geschwindigkeit und Qualität',
    },
    {
      id: 'openai/gpt-oss-safeguard-20b',
      label: 'GPT OSS Safeguard 20B',
      description: 'Mit Safety-Features, für produktiven Code',
    },
    {
      id: 'qwen/qwen3-32b',
      label: 'Qwen3 32B',
      description: 'Neues chinesisches Modell, sehr gut bei Code',
    },
    {
      id: 'groq/compound',
      label: 'Groq Compound',
      description: 'Experimentelles Compound-Modell',
    },
    {
      id: 'groq/compound-mini',
      label: 'Groq Compound Mini',
      description: 'Kleinere Compound-Variante, schneller',
    },
  ],
  gemini: [
    {
      id: 'gemini-1.5-pro-latest',
      label: 'Gemini 1.5 Pro',
      description: 'Beste Qualität, riesiger Kontext (2M Tokens)',
    },
    {
      id: 'gemini-2.0-flash-exp',
      label: 'Gemini 2.0 Flash Experimental',
      description: 'Neueste Version, experimentell, sehr schnell',
    },
    {
      id: 'gemini-1.5-flash-latest',
      label: 'Gemini 1.5 Flash',
      description: 'Schneller als Pro, gute Balance',
    },
    {
      id: 'gemini-1.5-flash-8b',
      label: 'Gemini 1.5 Flash 8B',
      description: 'Kompakte Version, sehr schnell',
    },
  ],
  openai: [
    {
      id: 'gpt-4o',
      label: 'GPT-4o',
      description: 'Neuestes Modell, optimiert für Code & Reasoning',
    },
    {
      id: 'gpt-4o-mini',
      label: 'GPT-4o mini',
      description: 'Günstigere Variante, immer noch sehr gut',
    },
    {
      id: 'gpt-4-turbo',
      label: 'GPT-4 Turbo',
      description: 'Schnellere GPT-4-Version',
    },
    {
      id: 'gpt-3.5-turbo',
      label: 'GPT-3.5 Turbo',
      description: 'Günstig und schnell, für einfache Aufgaben',
    },
  ],
  anthropic: [
    {
      id: 'claude-3-5-sonnet-20241022',
      label: 'Claude 3.5 Sonnet (neu)',
      description: 'Neueste Version, exzellente Code-Qualität',
    },
    {
      id: 'claude-3-opus-20240229',
      label: 'Claude 3 Opus',
      description: 'Höchste Qualität, sehr gründlich',
    },
    {
      id: 'claude-3-sonnet-20240229',
      label: 'Claude 3 Sonnet',
      description: 'Gute Balance zwischen Qualität & Geschwindigkeit',
    },
    {
      id: 'claude-3-haiku-20240307',
      label: 'Claude 3 Haiku',
      description: 'Schnellste Claude-Variante, günstig',
    },
  ],
  huggingface: [
    {
      id: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      label: 'Qwen2.5 Coder 32B',
      description: 'Top Code-Modell, sehr gut für TypeScript/React',
    },
    {
      id: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
      label: 'LLaMA 3.1 8B (HF)',
      description: 'Open-Source LLaMA, guter Allrounder',
    },
    {
      id: 'mistralai/Mistral-7B-Instruct-v0.3',
      label: 'Mistral 7B Instruct',
      description: 'Beliebtes Open-Source-Modell',
    },
    {
      id: 'codellama/CodeLlama-34b-Instruct-hf',
      label: 'CodeLlama 34B',
      description: 'Spezialisiert auf Code-Generierung',
    },
    {
      id: 'bigcode/starcoder2-15b',
      label: 'StarCoder2 15B',
      description: 'Von BigCode, sehr gut bei Code-Completion',
    },
    {
      id: 'Salesforce/codegen25-7b-multi',
      label: 'CodeGen 2.5 7B Multi',
      description: 'Multi-Language Code-Generator',
    },
    {
      id: 'WizardLM/WizardCoder-15B-V1.0',
      label: 'WizardCoder 15B',
      description: 'Stark bei komplexen Code-Aufgaben',
    },
  ],
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
  } = useAI();

  const [newKey, setNewKey] = useState('');
  const [selectedKeyProvider, setSelectedKeyProvider] = useState<ProviderId>('groq');

  const generatorProvider = config.selectedChatProvider as ProviderId;
  const agentProvider = config.selectedAgentProvider as ProviderId;
  const currentGeneratorModes = AVAILABLE_MODES[generatorProvider] || [];
  const currentAgentModes = AVAILABLE_MODES[agentProvider] || [];

  const currentGeneratorMode = currentGeneratorModes.find((m) => m.id === config.selectedChatMode);
  const currentAgentMode = currentAgentModes.find((m) => m.id === config.selectedAgentMode);

  const isQualityMode = config.qualityMode === 'quality';

  // ✅ Alle Keys für den ausgewählten Provider
  const allKeys = config.apiKeys[selectedKeyProvider] || [];
  const hasMultipleKeys = allKeys.length > 1;

  const handleToggleQualityMode = async (value: boolean) => {
    await setQualityMode(value ? 'quality' : 'speed');
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
      Alert.alert(
        '✅ Gespeichert',
        `API-Key für ${PROVIDER_LABELS[selectedKeyProvider]} wurde hinzugefügt und ist jetzt aktiv.`
      );
    } catch (e: any) {
      Alert.alert('Fehler', e?.message || 'Konnte API-Key nicht speichern.');
    }
  };

  const handleRemoveKey = async (key: string) => {
    Alert.alert(
      'Key löschen?',
      `Möchtest du den Key ${key.slice(0, 8)}... wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeApiKey(selectedKeyProvider, key);
              Alert.alert('🗑️ Entfernt', 'API-Key wurde gelöscht.');
            } catch (e: any) {
              Alert.alert('Fehler', e?.message || 'Konnte API-Key nicht entfernen.');
            }
          },
        },
      ]
    );
  };

  const handleActivateKey = async (index: number) => {
    try {
      await moveApiKeyToFront(selectedKeyProvider, index);
      Alert.alert('✅ Aktiviert', 'Dieser Key ist jetzt aktiv.');
    } catch (e: any) {
      Alert.alert('Fehler', e?.message || 'Konnte Key nicht aktivieren.');
    }
  };

  const handleRotateKeys = async () => {
    if (!hasMultipleKeys) {
      Alert.alert('Keine Rotation möglich', 'Du benötigst mindestens 2 Keys für eine Rotation.');
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
            } catch (e: any) {
              Alert.alert('Fehler', e?.message || 'Rotation fehlgeschlagen.');
            }
          },
        },
      ]
    );
  };

  const renderProviderChips = (
    selectedProvider: ProviderId,
    onSelect: (p: ProviderId) => void
  ) => (
    <View style={styles.chipRow}>
      {(Object.keys(PROVIDER_LABELS) as ProviderId[]).map((id) => {
        const isSelected = id === selectedProvider;
        return (
          <TouchableOpacity
            key={id}
            style={[styles.chip, isSelected && styles.chipActive]}
            onPress={() => onSelect(id)}
          >
            <Text style={[styles.chipLabel, isSelected && styles.chipLabelActive]}>
              {PROVIDER_LABELS[id]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderModelList = (
    modes: { id: string; label: string; description?: string }[],
    selectedMode: string,
    onSelect: (modeId: string) => void
  ) => {
    if (!modes || modes.length === 0) {
      return (
        <Text style={styles.emptyText}>
          Für diesen Provider sind noch keine Modelle definiert.
        </Text>
      );
    }

    return (
      <View style={styles.modelList}>
        {modes.map((m) => {
          const isSelected = m.id === selectedMode;
          return (
            <TouchableOpacity
              key={m.id}
              style={[styles.modelRow, isSelected && styles.modelRowActive]}
              onPress={() => onSelect(m.id)}
            >
              <View style={styles.modelTextContainer}>
                <Text style={[styles.modelLabel, isSelected && styles.modelLabelActive]}>
                  {m.label}
                </Text>
                <Text style={styles.modelId} numberOfLines={1}>
                  {m.id}
                </Text>
                {m.description && (
                  <Text style={styles.modelDescription} numberOfLines={2}>
                    {m.description}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // ✅ Key-Liste rendern
  const renderApiKeyList = () => {
    if (allKeys.length === 0) {
      return (
        <View style={styles.emptyKeyState}>
          <Text style={styles.emptyKeyText}>
            🔑 Noch keine API-Keys für {PROVIDER_LABELS[selectedKeyProvider]} hinterlegt
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.keyListContainer}>
        <View style={styles.keyListHeader}>
          <Text style={styles.keyListTitle}>
            Gespeicherte Keys ({allKeys.length})
          </Text>
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
                {isActive && (
                  <Ionicons name="star" size={14} color={theme.palette.success} />
                )}
                <Text style={[styles.keyText, isActive && styles.keyTextActive]}>
                  {masked}
                </Text>
                {isActive && <Text style={styles.activeLabel}>AKTIV</Text>}
              </View>

              <View style={styles.keyActions}>
                {!isActive && (
                  <TouchableOpacity
                    onPress={() => handleActivateKey(index)}
                    style={styles.iconButton}
                  >
                    <Ionicons
                      name="arrow-up-circle-outline"
                      size={20}
                      color={theme.palette.primary}
                    />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => handleRemoveKey(key)}
                  style={styles.iconButton}
                >
                  <Ionicons name="trash-outline" size={20} color={theme.palette.error} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        <Text style={styles.keyListHint}>
          💡 Der oberste Key ist aktiv. Bei Rate-Limits rotiert die App automatisch zum nächsten.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* HEADER */}
        <Text style={styles.screenTitle}>⚙️ KI-Einstellungen</Text>
        <Text style={styles.screenSubtitle}>
          Konfiguriere Generator, Quality-Agent und API-Keys
        </Text>

        {/* ÜBERSICHT */}
        <View style={styles.overviewCard}>
          <Text style={styles.overviewTitle}>📊 Aktuelle Konfiguration</Text>

          <View style={styles.overviewSection}>
            <Text style={styles.overviewLabel}>Generator (Code-Erzeugung)</Text>
            <Text style={styles.overviewValue}>
              {PROVIDER_LABELS[generatorProvider]} •{' '}
              {currentGeneratorMode?.label || config.selectedChatMode}
            </Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.overviewSection}>
            <Text style={styles.overviewLabel}>Quality-Agent (Validator)</Text>
            <Text style={styles.overviewValue}>
              {PROVIDER_LABELS[agentProvider]} •{' '}
              {currentAgentMode?.label || config.selectedAgentMode}
            </Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.qualityRow}>
            <View>
              <Text style={styles.overviewLabel}>Quality Mode</Text>
              <Text style={styles.overviewHint}>
                {isQualityMode ? '💎 Aktiv - Beste Qualität' : '⚡ Aus - Maximale Geschwindigkeit'}
              </Text>
            </View>
            <Switch
              value={isQualityMode}
              onValueChange={handleToggleQualityMode}
              thumbColor={isQualityMode ? theme.palette.primary : '#ccc'}
              trackColor={{ false: '#767577', true: theme.palette.primary + '50' }}
            />
          </View>
        </View>

        {/* GENERATOR SETTINGS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🛠️ Generator (Code-Erzeugung)</Text>
          <Text style={styles.sectionSubtitle}>
            Diese KI erzeugt den Code basierend auf deinen Anfragen.
          </Text>

          <Text style={styles.subheading}>Provider</Text>
          {renderProviderChips(generatorProvider, setSelectedChatProvider)}

          <Text style={styles.providerDescription}>
            {PROVIDER_DESCRIPTIONS[generatorProvider]}
          </Text>

          <Text style={styles.subheading}>Modell</Text>
          {renderModelList(currentGeneratorModes, config.selectedChatMode, setSelectedChatMode)}
        </View>

        {/* QUALITY AGENT SETTINGS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💎 Quality-Agent (Validator)</Text>
          <Text style={styles.sectionSubtitle}>
            Wenn Quality Mode aktiv ist, prüft diese KI den generierten Code, korrigiert Pfade und
            entfernt Platzhalter.
          </Text>

          <Text style={styles.subheading}>Provider</Text>
          {renderProviderChips(agentProvider, setSelectedAgentProvider)}

          <Text style={styles.providerDescription}>{PROVIDER_DESCRIPTIONS[agentProvider]}</Text>

          <Text style={styles.subheading}>Modell</Text>
          {renderModelList(currentAgentModes, config.selectedAgentMode, setSelectedAgentMode)}
        </View>

        {/* API-KEY MANAGEMENT */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔑 API-Keys verwalten</Text>
          <Text style={styles.sectionSubtitle}>
            Hinterlege mehrere API-Keys pro Anbieter. Bei Rate-Limits rotiert die App automatisch.
          </Text>

          <Text style={styles.subheading}>Provider auswählen</Text>
          <View style={styles.chipRow}>
            {(Object.keys(PROVIDER_LABELS) as ProviderId[]).map((id) => {
              const isSelected = id === selectedKeyProvider;
              const keyCount = config.apiKeys[id]?.length || 0;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.chipSmall, isSelected && styles.chipActive]}
                  onPress={() => setSelectedKeyProvider(id)}
                >
                  <Text style={[styles.chipLabel, isSelected && styles.chipLabelActive]}>
                    {PROVIDER_LABELS[id]} {keyCount > 0 && `(${keyCount})`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ✅ Key-Liste */}
          {renderApiKeyList()}

          {/* Neuen Key hinzufügen */}
          <View style={styles.addKeySection}>
            <Text style={styles.subheading}>Neuen Key hinzufügen</Text>
            <TextInput
              style={styles.input}
              value={newKey}
              onChangeText={setNewKey}
              placeholder="API-Key hier einfügen..."
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
            💡 Keys werden lokal gespeichert und bei Rate-Limits automatisch rotiert (max. 3 Versuche).
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
    paddingBottom: 40,
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

  // ÜBERSICHT CARD
  overviewCard: {
    backgroundColor: theme.palette.primary + '15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.palette.primary + '30',
  },
  overviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.palette.text.primary,
    marginBottom: 12,
  },
  overviewSection: {
    marginBottom: 8,
  },
  overviewLabel: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginBottom: 4,
  },
  overviewValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.palette.text.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  overviewHint: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: theme.palette.border,
    marginVertical: 12,
  },

  // SECTIONS
  section: {
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.palette.text.primary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  subheading: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '600',
    color: theme.palette.text.secondary,
  },
  hintText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 8,
    lineHeight: 16,
  },

  // CHIPS
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.palette.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 6,
    marginBottom: 6,
    backgroundColor: theme.palette.card,
  },
  chipSmall: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
    marginBottom: 6,
    backgroundColor: theme.palette.card,
  },
  chipActive: {
    backgroundColor: theme.palette.primary,
    borderColor: theme.palette.primary,
  },
  chipLabel: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  chipLabelActive: {
    color: '#fff',
    fontWeight: '600',
  },

  // PROVIDER DESCRIPTION
  providerDescription: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 16,
    fontStyle: 'italic',
  },

  // MODEL LIST
  modelList: {
    marginTop: 4,
  },
  modelRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    padding: 12,
    marginBottom: 8,
    backgroundColor: theme.palette.card,
  },
  modelRowActive: {
    borderColor: theme.palette.primary,
    borderWidth: 2,
    backgroundColor: theme.palette.primary + '08',
  },
  modelTextContainer: {
    flex: 1,
  },
  modelLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.palette.text.primary,
    marginBottom: 2,
  },
  modelLabelActive: {
    color: theme.palette.primary,
  },
  modelId: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 4,
  },
  modelDescription: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    lineHeight: 16,
  },
  emptyText: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
    marginVertical: 8,
  },

  // QUALITY MODE
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // ✅ KEY LIST
  keyListContainer: {
    marginTop: 12,
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
    backgroundColor: theme.palette.card,
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
    backgroundColor: theme.palette.background,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  keyRowActive: {
    borderColor: theme.palette.success,
    borderWidth: 2,
    backgroundColor: theme.palette.success + '08',
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
    backgroundColor: theme.palette.background,
    borderRadius: 8,
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

  // ADD KEY
  addKeySection: {
    marginTop: 16,
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
});

export default SettingsScreen;
