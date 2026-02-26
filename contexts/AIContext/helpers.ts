// contexts/AIContext/helpers.ts
// Extracted from AIContext.tsx: config loading, key management, utilities.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { AIConfig, AllAIProviders, QualityMode } from "./models";
import { PROVIDER_DEFAULTS, AVAILABLE_MODELS } from "./models";

export const CONFIG_STORAGE_KEY = 'ai_config_v4';
export const AI_KEYS_SECURE_KEY = 'ai_api_keys_v1';
export const STORAGE_FALLBACK_KEYS = ['ai_config_v3', 'ai_config_v2', 'ai_config_v1'];

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

  const defs = (PROVIDER_DEFAULTS as any)?.[provider] as (typeof PROVIDER_DEFAULTS)[AllAIProviders] | undefined;
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

export function isModeValidForProvider(provider: AllAIProviders, mode: string): boolean {
  const list = AVAILABLE_MODELS?.[provider] ?? [];
  return list.some((m) => m.id === mode);
}



export async function loadSecureApiKeys(): Promise<Record<AllAIProviders, string[]>> {
  try {
    const raw = await SecureStore.getItemAsync(AI_KEYS_SECURE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG.apiKeys };
    const parsed = JSON.parse(raw) as Partial<Record<AllAIProviders, unknown>>;
    const next: Record<AllAIProviders, string[]> = { ...DEFAULT_CONFIG.apiKeys };
    (Object.keys(next) as AllAIProviders[]).forEach((p) => {
      const v = (parsed as any)?.[p];
      if (Array.isArray(v)) next[p] = v.map((k) => String(k ?? "").trim()).filter(Boolean);
    });
    return next;
  } catch {
    return { ...DEFAULT_CONFIG.apiKeys };
  }
}

export async function saveSecureApiKeys(keys: Record<AllAIProviders, string[]>): Promise<void> {
  const cleaned: Record<AllAIProviders, string[]> = { ...DEFAULT_CONFIG.apiKeys };
  (Object.keys(cleaned) as AllAIProviders[]).forEach((p) => {
    const v = (keys as any)?.[p];
    cleaned[p] = Array.isArray(v) ? v.map((k) => String(k ?? "").trim()).filter(Boolean) : [];
  });
  const hasAny = (Object.keys(cleaned) as AllAIProviders[]).some((p) => cleaned[p].length > 0);
  if (!hasAny) {
    await SecureStore.deleteItemAsync(AI_KEYS_SECURE_KEY).catch(() => undefined);
    return;
  }
  await SecureStore.setItemAsync(AI_KEYS_SECURE_KEY, JSON.stringify(cleaned)).catch(() => undefined);
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
      const parsed = JSON.parse(raw) as Partial<AIConfig>;
      if (!parsed || typeof parsed !== 'object') continue;

      const base: AIConfig = {
        ...DEFAULT_CONFIG,
        ...parsed,
        version: DEFAULT_CONFIG.version,
        apiKeys: {
          ...DEFAULT_CONFIG.apiKeys,
          ...((parsed as any).apiKeys ?? {}),
        },
        agentEnabled: typeof (parsed as any).agentEnabled === 'boolean' ? !!(parsed as any).agentEnabled : DEFAULT_CONFIG.agentEnabled,
      };

      const chatProvider = coerceProvider((base as any).selectedChatProvider, DEFAULT_CONFIG.selectedChatProvider);
      const agentProvider = coerceProvider((base as any).selectedAgentProvider, DEFAULT_CONFIG.selectedAgentProvider);
      const qm: QualityMode = (base.qualityMode as QualityMode) || DEFAULT_CONFIG.qualityMode;

      const rawChatMode = resolveLegacyAutoMode(
        chatProvider,
        qm,
        (parsed as any).selectedChatMode ?? base.selectedChatMode,
        base.selectedChatMode,
      );
      const rawAgentMode = resolveLegacyAutoMode(
        agentProvider,
        qm,
        (parsed as any).selectedAgentMode ?? base.selectedAgentMode,
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
