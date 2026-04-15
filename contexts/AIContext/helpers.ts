// contexts/AIContext/helpers.ts
// Extracted from AIContext.tsx: config loading, key management, utilities.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { AIConfig, AllAIProviders, ProviderDefaults, QualityMode } from "./models";
import { PROVIDER_DEFAULTS, AVAILABLE_MODELS } from "./models";

export const CONFIG_STORAGE_KEY = 'ai_config_v4';
export const AI_KEYS_SECURE_KEY = 'ai_api_keys_v1';
export const STORAGE_FALLBACK_KEYS = ['ai_config_v3', 'ai_config_v2', 'ai_config_v1'];
export type SecureApiKeysLoadState = "loaded" | "missing" | "unreadable";
export type SecureApiKeysLoadResult = {
  state: SecureApiKeysLoadState;
  keys: Record<AllAIProviders, string[]>;
  error?: unknown;
};

export const DEFAULT_CONFIG: AIConfig = {
  version: 4,
  selectedChatProvider: 'groq',
  selectedChatMode: PROVIDER_DEFAULTS.groq.speed,
  selectedAgentProvider: 'anthropic',
  selectedAgentMode: PROVIDER_DEFAULTS.anthropic.quality,
  qualityMode: 'speed',
  agentEnabled: true,
  apiKeys: { groq: [], gemini: [], openai: [], anthropic: [], huggingface: [] },
};

export function resolveLegacyAutoMode(provider: AllAIProviders, qualityMode: QualityMode, mode: unknown, fallback: string): string {
  const raw = typeof mode === 'string' ? mode.trim() : '';
  const isLegacyAuto = raw === '' || raw === 'auto' || raw.startsWith('auto-');
  if (!isLegacyAuto) return raw;

  const defs = PROVIDER_DEFAULTS?.[provider];
  if (!defs) return fallback;
  // balanced -> speed default, review -> quality default
  if (qualityMode === 'quality' || qualityMode === 'review') return defs.quality;
  return defs.speed;
}

export function getDefaultMode(provider: AllAIProviders, qualityMode: QualityMode): string {
  const defs = PROVIDER_DEFAULTS?.[provider];
  if (!defs) return '';
  // balanced -> speed default, review -> quality default
  if (qualityMode === 'quality' || qualityMode === 'review') return defs.quality;
  return defs.speed;
}


export function getModeKeyForQualityMode(mode: QualityMode): keyof ProviderDefaults {
  return mode === 'quality' || mode === 'review' ? 'quality' : 'speed';
}

export function resolveProviderModeForQualityMode(
  provider: AllAIProviders,
  mode: QualityMode,
): string {
  const modeKey = getModeKeyForQualityMode(mode);
  return PROVIDER_DEFAULTS[provider][modeKey];
}

export function buildProviderSelectionPatch(params: {
  providerType: "chat" | "agent";
  provider: AllAIProviders;
  qualityMode: QualityMode;
}): Partial<AIConfig> {
  const nextMode =
    getDefaultMode(params.provider, params.qualityMode) ||
    (params.providerType === "chat"
      ? PROVIDER_DEFAULTS[params.provider].speed
      : PROVIDER_DEFAULTS[params.provider].quality);

  if (params.providerType === "chat") {
    return {
      selectedChatProvider: params.provider,
      selectedChatMode: nextMode,
    };
  }

  return {
    selectedAgentProvider: params.provider,
    selectedAgentMode: nextMode,
  };
}

export function isModeValidForProvider(provider: AllAIProviders, mode: string): boolean {
  const list = AVAILABLE_MODELS?.[provider] ?? [];
  return list.some((m) => m.id === mode);
}

export function normalizeApiKeys(
  keys: Partial<Record<AllAIProviders, unknown>> | null | undefined,
): Record<AllAIProviders, string[]> {
  const next: Record<AllAIProviders, string[]> = { ...DEFAULT_CONFIG.apiKeys };
  (Object.keys(next) as AllAIProviders[]).forEach((provider) => {
    const value = keys?.[provider];
    next[provider] = Array.isArray(value)
      ? value.map((entry) => String(entry ?? "").trim()).filter(Boolean)
      : [];
  });
  return next;
}

export function hasAnyApiKeys(keys: Record<AllAIProviders, string[]>): boolean {
  return (Object.keys(keys) as AllAIProviders[]).some(
    (provider) => keys[provider].length > 0,
  );
}

export function resolveRehydratedApiKeys(params: {
  loadedApiKeys: Partial<Record<AllAIProviders, unknown>> | null | undefined;
  secureApiKeys: Partial<Record<AllAIProviders, unknown>> | null | undefined;
}): { finalKeys: Record<AllAIProviders, string[]>; shouldMigrateLegacyToSecure: boolean } {
  const loadedKeys = normalizeApiKeys(params.loadedApiKeys);
  const secureKeys = normalizeApiKeys(params.secureApiKeys);
  const shouldMigrateLegacyToSecure = !hasAnyApiKeys(secureKeys) && hasAnyApiKeys(loadedKeys);
  return {
    finalKeys: shouldMigrateLegacyToSecure ? loadedKeys : secureKeys,
    shouldMigrateLegacyToSecure,
  };
}

export async function loadSecureApiKeys(): Promise<SecureApiKeysLoadResult> {
  try {
    const raw = await SecureStore.getItemAsync(AI_KEYS_SECURE_KEY);
    if (!raw) {
      return {
        state: "missing",
        keys: normalizeApiKeys(undefined),
      };
    }
    const parsed = JSON.parse(raw) as Partial<Record<AllAIProviders, unknown>>;
    return {
      state: "loaded",
      keys: normalizeApiKeys(parsed),
    };
  } catch (error) {
    return {
      state: "unreadable",
      keys: normalizeApiKeys(undefined),
      error,
    };
  }
}

export async function saveSecureApiKeys(keys: Record<AllAIProviders, string[]>): Promise<void> {
  const cleaned = normalizeApiKeys(keys);
  if (!hasAnyApiKeys(cleaned)) {
    await SecureStore.deleteItemAsync(AI_KEYS_SECURE_KEY);
    return;
  }
  await SecureStore.setItemAsync(AI_KEYS_SECURE_KEY, JSON.stringify(cleaned));
}

export function coerceProvider(value: unknown, fallback: AllAIProviders): AllAIProviders {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  return Object.prototype.hasOwnProperty.call(PROVIDER_DEFAULTS, v) ? (v as AllAIProviders) : fallback;
}


export async function loadConfig(): Promise<AIConfig | null> {
  const keys = [CONFIG_STORAGE_KEY, ...STORAGE_FALLBACK_KEYS];
  for (const k of keys) {
    const raw = await AsyncStorage.getItem(k);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as Partial<AIConfig> & {
        apiKeys?: Partial<Record<AllAIProviders, unknown>>;
        agentEnabled?: unknown;
        selectedChatMode?: unknown;
        selectedAgentMode?: unknown;
      };
      if (!parsed || typeof parsed !== 'object') continue;

      const base: AIConfig = {
        ...DEFAULT_CONFIG,
        ...parsed,
        version: DEFAULT_CONFIG.version,
        apiKeys: {
          ...DEFAULT_CONFIG.apiKeys,
          ...(parsed.apiKeys ?? {}),
        },
        agentEnabled: typeof parsed.agentEnabled === 'boolean' ? !!parsed.agentEnabled : DEFAULT_CONFIG.agentEnabled,
      };

      const chatProvider = coerceProvider(base.selectedChatProvider, DEFAULT_CONFIG.selectedChatProvider);
      const agentProvider = coerceProvider(base.selectedAgentProvider, DEFAULT_CONFIG.selectedAgentProvider);
      const qm: QualityMode = (base.qualityMode as QualityMode) || DEFAULT_CONFIG.qualityMode;

      const rawChatMode = resolveLegacyAutoMode(
        chatProvider,
        qm,
        parsed.selectedChatMode ?? base.selectedChatMode,
        base.selectedChatMode,
      );
      const rawAgentMode = resolveLegacyAutoMode(
        agentProvider,
        qm,
        parsed.selectedAgentMode ?? base.selectedAgentMode,
        base.selectedAgentMode,
      );

      const fixed: AIConfig = {
        ...base,
        selectedChatProvider: chatProvider,
        selectedAgentProvider: agentProvider,
        selectedChatMode: isModeValidForProvider(chatProvider, rawChatMode)
          ? rawChatMode
          : getDefaultMode(chatProvider, qm) || base.selectedChatMode,
        selectedAgentMode: isModeValidForProvider(agentProvider, rawAgentMode)
          ? rawAgentMode
          : getDefaultMode(agentProvider, qm) || base.selectedAgentMode,
      };

      if (k !== CONFIG_STORAGE_KEY) {
        await AsyncStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(fixed));
      }

      return fixed;
    } catch {
      continue;
    }
  }
  return null;
}
