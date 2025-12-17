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
import type { AllAIProviders, ModelInfo, ModelTier, QualityMode } from '../contexts/AIContext';
import { AVAILABLE_MODELS, PROVIDER_METADATA } from '../contexts/AIContext';
import { useNotifications } from '../hooks/useNotifications';

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
  const modes = AVAILABLE_MODELS?.[provider] || [];
  if (modes.length === 0) {
    return <Text style={styles.emptyText}>Für diesen Provider sind noch keine Modelle definiert.</Text>;
  }

  return (
    <View style={styles.modeList}>
      {modes.map((m: ModelInfo) => {
        const isSelected = m.id === selectedMode;
        const tier = tierTokens[m.tier];
        const persona = (personaTokens as any)[m.persona] || personaTokens.balanced;
        const isHighlighted = m.persona === highlightPersona;

        return (
          <TouchableOpacity
            key={m.id}
            style={[styles.modeTile, isSelected && styles.modeTileActive, isHighlighted && styles.modeTileHighlight]}
            onPress={() => onSelect(m.id)}
          >
            <View style={styles.modeHead}>
              <Text style={[styles.modeTitle, isSelected && styles.modeTitleActive]}>{m.label}</Text>
              <View style={[styles.tierToken, { backgroundColor: tier.bg }]}>
                <Text style={[styles.tierTokenText, { color: tier.color }]}>{tier.label}</Text>
              </View>
            </View>

            <Text style={styles.modeDesc}>{m.description}</Text>

            <View style={styles.modeFoot}>
              <Text style={[styles.personaBadge, { borderColor: persona.color, color: persona.color }]}>
                {(persona as any).label}
              </Text>
              <Text style={styles.bestFor} numberOfLines={1}>
                {m.bestFor}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default function SettingsScreen() {
  const {
    config,
    setSelectedChatProvider,
    setSelectedChatMode,
    setSelectedAgentProvider,
    setSelectedAgentMode,
    setQualityMode,
    addApiKey,
    removeApiKey,
    rotateApiKey,
    moveApiKeyToFront,
    setAgentEnabled,
    providerStatus,
  } = useAI();

  const [newKey, setNewKey] = useState('');
  const [selectedKeyProvider, setSelectedKeyProvider] = useState<ProviderId>('groq');

  // Notifications
  const { isInitialized, hasPermissions, requestPermissions, pushToken } = useNotifications();

  // ✅ bulletproof falls config/apiKeys mal kurz kaputt wären
  const apiKeys = (config as any)?.apiKeys ?? {};
  const generatorProvider = ((config as any)?.selectedChatProvider ?? 'groq') as ProviderId;
  const agentProvider = ((config as any)?.selectedAgentProvider ?? 'anthropic') as ProviderId;
  const selectedChatMode = (config as any)?.selectedChatMode ?? 'auto';
  const selectedAgentMode = (config as any)?.selectedAgentMode ?? 'auto';
  const qualityMode = ((config as any)?.qualityMode ?? 'speed') as QualityMode;
  const agentEnabled = !!(config as any)?.agentEnabled;

  const isQualityMode = qualityMode === 'quality';
  const allKeys = (apiKeys?.[selectedKeyProvider] ?? []) as string[];
  const hasMultipleKeys = allKeys.length > 1;

  // ✅ robust: providerStatus can be Record<provider, status> OR an array of entries
  const getProviderStatus = (provider: ProviderId) => {
    const ps: any = providerStatus as any;
    const fallback = {
      limitReached: false,
      status: 'ok',
      message: '',
      lastRotation: undefined as any,
    };

    if (!ps) return fallback;

    if (Array.isArray(ps)) {
      const hit = ps.find((x: any) => x?.provider === provider || x?.id === provider);
      if (!hit) return fallback;
      const status = hit.status ?? (hit.limitReached ? 'rate_limited' : 'ok');
      return {
        ...fallback,
        ...hit,
        status,
        limitReached: hit.limitReached ?? (status === 'rate_limited'),
      };
    }

    if (typeof ps === 'object') {
      const hit = ps[provider];
      if (!hit) return fallback;
      const status = hit.status ?? (hit.limitReached ? 'rate_limited' : 'ok');
      return {
        ...fallback,
        ...hit,
        status,
        limitReached: hit.limitReached ?? (status === 'rate_limited'),
      };
    }

    return fallback;
  };

  const limitStatus = getProviderStatus(selectedKeyProvider);

  const generatorHighlightPersona = isQualityMode ? 'quality' : 'speed';
  const agentHighlightPersona: 'speed' | 'quality' = 'quality';

  const limitInfo = useMemo(() => {
    if (!limitStatus?.limitReached) {
      return 'Alles grün – aktueller Key liefert noch freie Tokens.';
    }
    const ts = (limitStatus as any).lastRotation
      ? new Date((limitStatus as any).lastRotation).toLocaleTimeString()
      : 'gerade eben';
    return `Limit erreicht (Free/Quota). Automatisch rotiert um ${ts}.`;
  }, [limitStatus]);

  const handleSetQuality = (mode: QualityMode) => {
    setQualityMode(mode);
    Alert.alert('Quality Mode', `Quality Mode wurde gesetzt auf: ${mode}`);
  };

  const handleAddKey = async () => {
    const trimmed = newKey.trim();
    if (!trimmed) return;

    try {
      await addApiKey(selectedKeyProvider, trimmed);
      setNewKey('');
      Alert.alert('OK', 'API Key hinzugefügt.');
    } catch (error: any) {
      Alert.alert('Fehler', error?.message || 'Key konnte nicht hinzugefügt werden.');
    }
  };

  const handleRemoveKey = async (key: string) => {
    Alert.alert('Key löschen', 'Möchtest du diesen Key wirklich entfernen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeApiKey(selectedKeyProvider, key);
          } catch (error: any) {
            Alert.alert('Fehler', error?.message || 'Key konnte nicht entfernt werden.');
          }
        },
      },
    ]);
  };

  const handleRotateKey = async () => {
    if (!hasMultipleKeys) {
      Alert.alert('Rotation', 'Du brauchst mindestens 2 Keys für Rotation.');
      return;
    }

    Alert.alert('Key Rotation', 'Soll der nächste Key aktiviert werden?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Rotieren',
        onPress: async () => {
          try {
            await rotateApiKey(selectedKeyProvider);
          } catch (error: any) {
            Alert.alert('Fehler', error?.message || 'Rotation fehlgeschlagen.');
          }
        },
      },
    ]);
  };

  const handleMoveKeyToFront = async (key: string, index: number) => {
    try {
      await moveApiKeyToFront(selectedKeyProvider, key);
      return;
    } catch {}
    try {
      await moveApiKeyToFront(selectedKeyProvider, index);
    } catch (error: any) {
      Alert.alert('Fehler', error?.message || 'Konnte Key nicht aktiv setzen.');
    }
  };

  const renderProviderTiles = (selectedProvider: ProviderId, onSelect: (provider: ProviderId) => void) => (
    <View>
      {PROVIDER_IDS.map((id) => {
        const meta = PROVIDER_METADATA?.[id];
        if (!meta) return null;

        const status = getProviderStatus(id);
        const keyCount = (apiKeys?.[id] ?? []).length;
        const isSelected = id === selectedProvider;

        const lampStyle = status.limitReached
          ? styles.statusLampAlert
          : keyCount > 0
            ? styles.statusLampOk
            : styles.statusLampIdle;

        return (
          <TouchableOpacity
            key={id}
            onPress={() => onSelect(id)}
            activeOpacity={0.85}
            style={[styles.providerTile, isSelected && styles.providerTileActive]}
          >
            <View style={styles.providerTop}>
              <View style={[styles.statusLamp, lampStyle]} />
              <Text style={styles.providerTitle}>
                {meta.emoji} {meta.label}
              </Text>
            </View>

            <Text style={styles.providerDesc}>{meta.description}</Text>

            <View style={styles.providerFoot}>
              <Text style={styles.providerKeys}>
                Keys: <Text style={styles.providerKeysStrong}>{keyCount}</Text>
              </Text>
              {status.limitReached && (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>LIMIT</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }}>
        <Text style={styles.h1}>KI Einstellungen</Text>

        <View style={styles.card}>
          <Text style={styles.h2}>Generator (Chat)</Text>
          {renderProviderTiles(generatorProvider, (p) => setSelectedChatProvider(p))}
          <Text style={styles.h3}>Model</Text>
          <ModeList
            provider={generatorProvider}
            selectedMode={selectedChatMode}
            onSelect={(modeId) => setSelectedChatMode(modeId)}
            highlightPersona={generatorHighlightPersona}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.h2}>Agent</Text>

          <View style={styles.agentToggleRow}>
            <Text style={styles.agentToggleLabel}>Zusätzlicher Agent</Text>
            <View style={styles.agentTogglePills}>
              <TouchableOpacity
                style={[styles.agentTogglePill, agentEnabled && styles.agentTogglePillActive]}
                onPress={() => setAgentEnabled(true)}
                activeOpacity={0.85}
              >
                <Text style={[styles.agentTogglePillText, agentEnabled && styles.agentTogglePillTextActive]}>An</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.agentTogglePill, !agentEnabled && styles.agentTogglePillActiveOff]}
                onPress={() => setAgentEnabled(false)}
                activeOpacity={0.85}
              >
                <Text style={[styles.agentTogglePillText, !agentEnabled && styles.agentTogglePillTextActiveOff]}>
                  Aus
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.agentToggleHint}>
            Wenn „Aus“, wird nur der Generator genutzt (kein zweiter Review-Pass).
          </Text>

          {renderProviderTiles(agentProvider, (p) => setSelectedAgentProvider(p))}
          <Text style={styles.h3}>Model</Text>
          <ModeList
            provider={agentProvider}
            selectedMode={selectedAgentMode}
            onSelect={(modeId) => setSelectedAgentMode(modeId)}
            highlightPersona={agentHighlightPersona}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.h2}>Quality Mode</Text>
          <View style={styles.qualityRow}>
            {(['speed', 'balanced', 'quality', 'review'] as QualityMode[]).map((m) => {
              const isActive = qualityMode === m;
              const tok = (personaTokens as any)[m] || personaTokens.balanced;

              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => handleSetQuality(m)}
                  activeOpacity={0.85}
                  style={[styles.qualityBtn, isActive && styles.qualityBtnActive]}
                >
                  <Text style={[styles.qualityBtnText, { color: tok.color }, isActive && styles.qualityBtnTextActive]}>
                    {(tok as any).label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.note}>{limitInfo}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.h2}>API Keys</Text>

          <View style={styles.providerPickerRow}>
            {PROVIDER_IDS.map((p) => {
              const isActive = p === selectedKeyProvider;
              const meta = PROVIDER_METADATA[p];
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => setSelectedKeyProvider(p)}
                  style={[styles.providerChip, isActive && styles.providerChipActive]}
                >
                  <Text style={[styles.providerChipText, isActive && styles.providerChipTextActive]}>
                    {meta.emoji} {meta.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.keyRow}>
            <TextInput
              value={newKey}
              onChangeText={setNewKey}
              placeholder="API Key einfügen…"
              placeholderTextColor={theme.palette.text.secondary}
              style={styles.keyInput}
              autoCapitalize="none"
              autoCorrect={false}
              multiline={false}
            />
            <TouchableOpacity style={styles.keyAddBtn} onPress={handleAddKey} activeOpacity={0.85}>
              <Ionicons name="add" size={18} color="#000" />
              <Text style={styles.keyAddBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.keyList}>
            {allKeys.length === 0 ? (
              <Text style={styles.emptyText}>Noch keine Keys gespeichert.</Text>
            ) : (
              allKeys.map((k, i) => (
                <View key={`${k}-${i}`} style={styles.keyItem}>
                  <Text style={styles.keyText} numberOfLines={1}>
                    {k}
                  </Text>

                  <View style={styles.keyActions}>
                    {hasMultipleKeys && i !== 0 && (
                      <TouchableOpacity
                        onPress={() => handleMoveKeyToFront(k, i)}
                        style={styles.keyActionBtn}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="flash" size={16} color={theme.palette.primary} />
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => handleRemoveKey(k)}
                      style={[styles.keyActionBtn, styles.keyActionDanger]}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="trash" size={16} color={theme.palette.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          <TouchableOpacity style={styles.rotateBtn} onPress={handleRotateKey} activeOpacity={0.85}>
            <Ionicons name="refresh" size={18} color="#000" />
            <Text style={styles.rotateBtnText}>Key rotieren</Text>
          </TouchableOpacity>

          <Text style={styles.tokenPreview}>
            Hinweis: Anzeige “LIMIT” kommt nur, wenn dein Rate-Limiter/Status das meldet.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.h2}>Notifications</Text>
          <Text style={styles.note}>
            Status: <Text style={styles.noteStrong}>{isInitialized ? 'Initialisiert' : 'Nicht initialisiert'}</Text>{'\n'}
            Permissions: <Text style={styles.noteStrong}>{hasPermissions ? 'OK' : 'Fehlt'}</Text>{'\n'}
            Token: <Text style={styles.noteStrong}>{pushToken ? 'Vorhanden' : '—'}</Text>
          </Text>

          {!hasPermissions && (
            <TouchableOpacity style={styles.notifyBtn} onPress={requestPermissions} activeOpacity={0.85}>
              <Ionicons name="notifications" size={18} color="#000" />
              <Text style={styles.notifyBtnText}>Permissions anfordern</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.palette.background },
  container: { flex: 1, padding: 16 },

  h1: { fontSize: 24, fontWeight: '900', color: theme.palette.text.primary, marginBottom: 12 },
  h2: { fontSize: 16, fontWeight: '900', color: theme.palette.text.primary, marginBottom: 12 },
  h3: { fontSize: 13, fontWeight: '900', color: theme.palette.text.secondary, marginTop: 10, marginBottom: 8 },

  card: {
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },

  providerTile: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    backgroundColor: theme.palette.background,
  },
  providerTileActive: {
    borderColor: theme.palette.primary,
    shadowColor: theme.palette.primary,
    shadowOpacity: Platform.OS === 'ios' ? 0.25 : 0,
    shadowRadius: 8,
    elevation: 3,
  },
  providerTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  providerTitle: { fontWeight: '900', color: theme.palette.text.primary, fontSize: 14 },
  providerDesc: { color: theme.palette.text.secondary, fontSize: 12, lineHeight: 18 },
  providerFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  providerKeys: { color: theme.palette.text.secondary, fontSize: 12 },
  providerKeysStrong: { color: theme.palette.text.primary, fontWeight: '900' },

  statusLamp: { width: 10, height: 10, borderRadius: 999, borderWidth: 1, borderColor: theme.palette.border },
  statusLampOk: { backgroundColor: theme.palette.primary, borderColor: theme.palette.primary },
  statusLampIdle: { backgroundColor: theme.palette.border, borderColor: theme.palette.border },
  statusLampAlert: { backgroundColor: theme.palette.error, borderColor: theme.palette.error },

  alertBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: theme.palette.error + '22' },
  alertBadgeText: { color: theme.palette.error, fontWeight: '900', fontSize: 11 },

  emptyText: { color: theme.palette.text.secondary, fontSize: 12 },

  modeList: { gap: 10 },
  modeTile: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 16,
    padding: 12,
    backgroundColor: theme.palette.background,
  },
  modeTileActive: { borderColor: theme.palette.primary },
  modeTileHighlight: { borderColor: '#7c4dff' },
  modeHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modeTitle: { fontWeight: '900', color: theme.palette.text.primary, fontSize: 13 },
  modeTitleActive: { color: theme.palette.primary },
  tierToken: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  tierTokenText: { fontWeight: '900', fontSize: 11 },
  modeDesc: { color: theme.palette.text.secondary, fontSize: 12, marginTop: 6 },
  modeFoot: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  personaBadge: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontWeight: '900',
    fontSize: 11,
  },
  bestFor: { color: theme.palette.text.secondary, fontSize: 12, flex: 1 },

  qualityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  qualityBtn: { borderWidth: 1, borderColor: theme.palette.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  qualityBtnActive: { borderColor: theme.palette.primary },
  qualityBtnText: { fontWeight: '900', fontSize: 12 },
  qualityBtnTextActive: { color: theme.palette.primary },

  note: { marginTop: 10, color: theme.palette.text.secondary, fontSize: 12, lineHeight: 18 },
  noteStrong: { color: theme.palette.text.primary, fontWeight: '900' },

  providerPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, marginBottom: 10 },
  providerChip: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.palette.background,
  },
  providerChipActive: { borderColor: theme.palette.primary },
  providerChipText: { color: theme.palette.text.secondary, fontWeight: '900', fontSize: 12 },
  providerChipTextActive: { color: theme.palette.primary },

  keyRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  keyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background,
  },
  keyAddBtn: {
    borderRadius: 16,
    backgroundColor: theme.palette.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  keyAddBtnText: { fontWeight: '900', color: '#000' },

  keyList: { marginTop: 12, gap: 10 },
  keyItem: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.palette.background,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  keyText: { flex: 1, color: theme.palette.text.primary, fontSize: 12 },
  keyActions: { flexDirection: 'row', gap: 8 },
  keyActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.palette.card,
  },
  keyActionDanger: { borderColor: theme.palette.error + '55' },

  rotateBtn: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: theme.palette.primary,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotateBtnText: { fontWeight: '900', color: '#000' },

  agentToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 12,
  },
  agentToggleLabel: { color: theme.palette.text.primary, fontWeight: '900', fontSize: 13 },
  agentTogglePills: { flexDirection: 'row', gap: 8 },
  agentTogglePill: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'transparent',
    minWidth: 64,
    alignItems: 'center',
  },
  agentTogglePillActive: { borderColor: theme.palette.primary, backgroundColor: theme.palette.primary + '22' },
  agentTogglePillActiveOff: { borderColor: theme.palette.error, backgroundColor: theme.palette.error + '18' },
  agentTogglePillText: { color: theme.palette.text.secondary, fontWeight: '900' },
  agentTogglePillTextActive: { color: theme.palette.primary },
  agentTogglePillTextActiveOff: { color: theme.palette.error },
  agentToggleHint: { color: theme.palette.text.secondary, fontSize: 12, marginBottom: 6 },

  notifyBtn: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: theme.palette.primary,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifyBtnText: { fontWeight: '900', color: '#000' },

  tokenPreview: { marginTop: 8, color: theme.palette.text.secondary, fontSize: 12 },
});
