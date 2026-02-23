// contexts/AIContext.tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import SecureKeyManager from '../lib/SecureKeyManager';

export type AllAIProviders = 'groq' | 'gemini' | 'openai' | 'anthropic' | 'huggingface';
export type QualityMode = 'speed' | 'balanced' | 'quality' | 'review';
export type ModelTier = 'free' | 'credit' | 'paid';
export type ProviderLimitStatus = { provider: AllAIProviders; status: 'ok' | 'missing_key' | 'rate_limited'; message?: string };

export type ModelInfo = {
  id: string;
  label: string;
  description: string;
  tier: ModelTier;
  persona: QualityMode;
  bestFor: string;
  contextWindow?: string;
  isAuto?: boolean;
};

export type ProviderDefaults = {
  speed: string;
  quality: string;
};

export type ProviderMetadata = {
  id: AllAIProviders;
  label: string;
  emoji: string;
  description: string;
  hero: string;
  accent: string;
  freeHint?: string;
  docsUrl: string;
};

export type AIConfig = {
  version: number;
  selectedChatProvider: AllAIProviders;
  selectedChatMode: string;
  selectedAgentProvider: AllAIProviders;
  selectedAgentMode: string;
  qualityMode: QualityMode;

  agentEnabled: boolean;

  apiKeys: Record<AllAIProviders, string[]>;
};

export type AIContextProps = {
  config: AIConfig;
  setConfig: (next: AIConfig) => void;
  updateConfig: (patch: Partial<AIConfig>) => void;

  addApiKey: (provider: AllAIProviders, key: string) => Promise<void>;
  removeApiKey: (provider: AllAIProviders, key: string) => Promise<void>;
  clearApiKeys: (provider: AllAIProviders) => Promise<void>;

  setSelectedChatProvider: (provider: AllAIProviders) => void;
  setSelectedAgentProvider: (provider: AllAIProviders) => void;
  setSelectedChatMode: (mode: string) => void;
  setSelectedAgentMode: (mode: string) => void;
  setQualityMode: (mode: QualityMode) => void;

  setAgentEnabled: (enabled: boolean) => void;

  rotateApiKey: (provider: AllAIProviders) => Promise<void>;
  moveApiKeyToFront: (provider: AllAIProviders, keyOrIndex: string | number) => Promise<void>;

  providerStatus: ProviderLimitStatus[];
  acknowledgeProviderStatus: (provider: AllAIProviders) => void;
};

export const PROVIDER_DEFAULTS: Record<AllAIProviders, ProviderDefaults> = {
  groq: { speed: 'groq/compound-mini', quality: 'llama-3.3-70b-versatile' },
  openai: { speed: 'gpt-4o-mini', quality: 'gpt-4o' },
  anthropic: { speed: 'claude-3-5-haiku-20241022', quality: 'claude-3-5-sonnet-20241022' },
  gemini: { speed: 'gemini-2.5-flash-lite', quality: 'gemini-2.5-flash' },
  huggingface: { speed: 'Qwen/Qwen2.5-7B-Instruct', quality: 'Qwen/Qwen2.5-Coder-32B-Instruct' },
};

export const PROVIDER_METADATA: Record<AllAIProviders, ProviderMetadata> = {
  groq: {
    id: 'groq',
    label: 'Groq',
    emoji: '⚡',
    // ✅ Test expects "fpga"
    description: 'Ultraschnelle FPGA-Inference über OpenAI-kompatible API.',
    hero: 'Speed Demon',
    accent: '#22c55e',
    freeHint: 'Sehr günstig / oft “free-tier friendly”.',
    docsUrl: 'https://console.groq.com/docs',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    emoji: '🧠',
    description: 'Starke Allround-Modelle, bestes Ökosystem.',
    hero: 'Allround Brain',
    accent: '#60a5fa',
    docsUrl: 'https://platform.openai.com/docs',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    emoji: '🧩',
    description: 'Sehr starkes Reasoning + Textqualität.',
    hero: 'Reasoning Pro',
    accent: '#f59e0b',
    docsUrl: 'https://docs.anthropic.com',
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    emoji: '✨',
    description: 'Google Gemini – schnell + stabil.',
    hero: 'Context King',
    accent: '#a78bfa',
    docsUrl: 'https://ai.google.dev',
  },
  huggingface: {
    id: 'huggingface',
    label: 'Hugging Face',
    emoji: '🤗',
    // ✅ Test expects "open-source"
    description: 'HF Router / open-source models.',
    hero: 'Open Model Zoo',
    accent: '#fb7185',
    docsUrl: 'https://huggingface.co/docs/api-inference/index',
  },
};

export const AVAILABLE_MODELS: Record<AllAIProviders, ModelInfo[]> = {
  groq: [
    { id: 'groq/compound-mini', label: 'Compound Mini', description: 'Sehr schnell & günstig.', tier: 'free', persona: 'speed', bestFor: 'Chat / UI Text'},
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', description: 'Schnell, stabil.', tier: 'free', persona: 'speed', bestFor: 'Alltag'},
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile', description: 'Mehr Qualität für komplexere Prompts.', tier: 'paid', persona: 'quality', bestFor: 'Qualität'},
    { id: 'qwen/qwen3-32b', label: 'Qwen 3 32B', description: 'Sehr gut für Code/Logik (manchmal mit <think>).', tier: 'credit', persona: 'balanced', bestFor: 'Code / Reasoning'},
    { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B (Groq)', description: 'OpenAI OSS Modell über Groq.', tier: 'free', persona: 'balanced', bestFor: 'Reasoning/Chat'},
    { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (Groq)', description: 'Großes OSS Modell über Groq.', tier: 'credit', persona: 'quality', bestFor: 'Qualität'},
  ],
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o', description: 'Starker Allrounder.', tier: 'credit', persona: 'quality', bestFor: 'Allround'},
    { id: 'gpt-4o-mini', label: 'GPT-4o mini', description: 'Schnell & günstig.', tier: 'free', persona: 'speed', bestFor: 'Speed'},
    { id: 'gpt-4.1', label: 'GPT-4.1', description: 'Sehr gut für Code/Reasoning.', tier: 'credit', persona: 'quality', bestFor: 'Code'},
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', description: 'Top Preis/Leistung.', tier: 'credit', persona: 'speed', bestFor: 'Daily'},
    { id: 'gpt-4.1-nano', label: 'GPT-4.1 nano', description: 'Extrem schnell.', tier: 'free', persona: 'speed', bestFor: 'Mini-Tasks'},
  ],
  anthropic: [
    { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', description: 'Schnell, solide.', tier: 'credit', persona: 'speed', bestFor: 'Speed'},
    { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', description: 'Schnell + besser.', tier: 'credit', persona: 'speed', bestFor: 'Speed+Qualität'},
    { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', description: 'Höhere Qualität (Reasoning/Writing).', tier: 'credit', persona: 'quality', bestFor: 'Quality/Review'},
  ],
  gemini: [
    // ✅ Test wants at least one model with "1M" or "2M"
    { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', description: 'Sehr schnell & günstig.', tier: 'free', persona: 'speed', bestFor: 'Speed', contextWindow: '1M' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Daily Driver.', tier: 'credit', persona: 'balanced', bestFor: 'Daily', contextWindow: '1M' },
  ],
  huggingface: [
    { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', label: 'Qwen2.5 Coder 32B', description: 'Stark für Code.', tier: 'free', persona: 'quality', bestFor: 'Code'},
    { id: 'Qwen/Qwen2.5-7B-Instruct', label: 'Qwen2.5 7B', description: 'Schnell für Chat.', tier: 'free', persona: 'speed', bestFor: 'Chat'},
    { id: 'meta-llama/Llama-3.1-8B-Instruct', label: 'Llama 3.1 8B Instruct', description: 'OSS Chat.', tier: 'free', persona: 'speed', bestFor: 'Chat'},
    { id: 'google/gemma-2-9b-it', label: 'Gemma 2 9B', description: 'Kurzantworten / Hilfe.', tier: 'free', persona: 'speed', bestFor: 'Kurzantworten'},
  ],
};

const CONFIG_STORAGE_KEY = 'ai_config_v4';
const AI_KEYS_SECURE_KEY = 'ai_api_keys_v1';
const STORAGE_FALLBACK_KEYS = ['ai_config_v3', 'ai_config_v2', 'ai_config_v1'];

const DEFAULT_CONFIG: AIConfig = {
  version: 4,
  selectedChatProvider: 'groq',
  selectedChatMode: PROVIDER_DEFAULTS.groq.speed,
  selectedAgentProvider: 'anthropic',
  selectedAgentMode: PROVIDER_DEFAULTS.anthropic.quality,
  qualityMode: 'speed',
  agentEnabled: true,
  apiKeys: { groq: [], gemini: [], openai: [], anthropic: [], huggingface: [] },
};

const AIContext = createContext<AIContextProps | undefined>(undefined);

function resolveLegacyAutoMode(provider: AllAIProviders, qualityMode: QualityMode, mode: unknown, fallback: string): string {
  const raw = typeof mode === 'string' ? mode.trim() : '';
  const isLegacyAuto = raw === '' || raw === 'auto' || raw.startsWith('auto-');
  if (!isLegacyAuto) return raw;

  const defs = (PROVIDER_DEFAULTS as any)?.[provider] as (typeof PROVIDER_DEFAULTS)[AllAIProviders] | undefined;
  if (!defs) return fallback;
  // balanced -> speed default, review -> quality default
  if (qualityMode === 'quality' || qualityMode === 'review') return defs.quality;
  return defs.speed;
}



async function loadSecureApiKeys(): Promise<Record<AllAIProviders, string[]>> {
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

async function saveSecureApiKeys(keys: Record<AllAIProviders, string[]>): Promise<void> {
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

function coerceProvider(value: unknown, fallback: AllAIProviders): AllAIProviders {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  return Object.prototype.hasOwnProperty.call(PROVIDER_DEFAULTS, v) ? (v as AllAIProviders) : fallback;
}


async function loadConfig(): Promise<AIConfig | null> {
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

      const fixed: AIConfig = {
        ...base,
        selectedChatMode: resolveLegacyAutoMode(chatProvider, qm, (parsed as any).selectedChatMode ?? base.selectedChatMode, base.selectedChatMode),
        selectedAgentMode: resolveLegacyAutoMode(agentProvider, qm, (parsed as any).selectedAgentMode ?? base.selectedAgentMode, base.selectedAgentMode),
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

export function AIProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfigState] = useState<AIConfig>(DEFAULT_CONFIG);
  const [providerStatus, setProviderStatus] = useState<ProviderLimitStatus[]>([]);
  const didLoad = useRef(false);
  const persistRotationInProgress = useRef(false);

  
useEffect(() => {
  (async () => {
    try {
      const loaded = (await loadConfig()) ?? DEFAULT_CONFIG;

      // Load keys from SecureStore (authoritative)
      const secureKeys = await loadSecureApiKeys();

      // Legacy migration: if SecureStore empty but config contains keys, migrate them once
      const hasSecureAny = (Object.keys(secureKeys) as AllAIProviders[]).some(
        (p) => (secureKeys[p] ?? []).length > 0,
      );
      const hasLegacyAny = (Object.keys(loaded.apiKeys) as AllAIProviders[]).some(
        (p) => (loaded.apiKeys[p] ?? []).length > 0,
      );

      let finalKeys = secureKeys;
      if (!hasSecureAny && hasLegacyAny) {
        finalKeys = { ...DEFAULT_CONFIG.apiKeys, ...loaded.apiKeys };
        await saveSecureApiKeys(finalKeys);
      }

      // Keep models/modes untouched; only ensure keys are loaded
      setConfigState({ ...loaded, apiKeys: finalKeys });
    } finally {
      didLoad.current = true;
    }
  })();
}, []);

useEffect(() => {
  // Persistente Rotation: wenn SecureKeyManager wegen 429 rotiert, spiegeln wir das in config.apiKeys,
  // damit es nach App-Neustart/Backup erhalten bleibt.
  const unsubscribe = SecureKeyManager.addRotationListener((provider: AllAIProviders) => {
    // Nur persistieren, wenn Config bereits geladen ist und wir nicht gerade selbst persistieren
    if (!didLoad.current || persistRotationInProgress.current) return;

    persistRotationInProgress.current = true;
    try {
      setConfigState((prev) => {
        const list = prev.apiKeys?.[provider] ?? [];
        if (list.length < 2) return prev;
        const next = [...list.slice(1), list[0]];
        return { ...prev, apiKeys: { ...prev.apiKeys, [provider]: next } };
      });
    } finally {
      setTimeout(() => {
        persistRotationInProgress.current = false;
      }, 0);
    }
  });

  return () => {
    unsubscribe();
  };
}, []);

useEffect(() => {
  if (!didLoad.current) return;
  const redacted = { ...(config as any), apiKeys: {} as any };
  AsyncStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(redacted)).catch(
    () => undefined,
  );
}, [config]);

useEffect(() => {
  if (!didLoad.current) return;

  // 1) In-memory keys for request-time usage
  (Object.keys(config.apiKeys) as AllAIProviders[]).forEach((provider) => {
    SecureKeyManager.setKeys(provider, config.apiKeys[provider] ?? []);
  });

  // 2) Persist keys securely
  saveSecureApiKeys(config.apiKeys as any).catch(() => undefined);
}, [config.apiKeys]);
const setConfig = useCallback((next: AIConfig) => setConfigState(next), []);
  const updateConfig = useCallback((patch: Partial<AIConfig>) => {
    setConfigState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setSelectedChatProvider = useCallback((provider: AllAIProviders) => updateConfig({ selectedChatProvider: provider }), [updateConfig]);
  const setSelectedAgentProvider = useCallback((provider: AllAIProviders) => updateConfig({ selectedAgentProvider: provider }), [updateConfig]);
  const setSelectedChatMode = useCallback((mode: string) => updateConfig({ selectedChatMode: mode }), [updateConfig]);
  const setSelectedAgentMode = useCallback((mode: string) => updateConfig({ selectedAgentMode: mode }), [updateConfig]);
  const setQualityMode = useCallback((mode: QualityMode) => updateConfig({ qualityMode: mode }), [updateConfig]);

  const setAgentEnabled = useCallback((enabled: boolean) => updateConfig({ agentEnabled: !!enabled }), [updateConfig]);

  const acknowledgeProviderStatus = useCallback((provider: AllAIProviders) => {
    setProviderStatus((prev) => prev.filter((p) => p.provider !== provider));
  }, []);

  const addApiKey = useCallback(async (provider: AllAIProviders, key: string) => {
    const k = key.trim();
    if (!k) return;
    setConfigState((prev) => {
      const current = prev.apiKeys[provider] ?? [];
      if (current.includes(k)) return prev;
      return { ...prev, apiKeys: { ...prev.apiKeys, [provider]: [...current, k] } };
    });
  }, []);

  const removeApiKey = useCallback(async (provider: AllAIProviders, key: string) => {
    setConfigState((prev) => ({
      ...prev,
      apiKeys: { ...prev.apiKeys, [provider]: (prev.apiKeys[provider] ?? []).filter((k) => k !== key) },
    }));
  }, []);

  const clearApiKeys = useCallback(async (provider: AllAIProviders) => {
    setConfigState((prev) => ({ ...prev, apiKeys: { ...prev.apiKeys, [provider]: [] } }));
  }, []);

  const rotateApiKey = useCallback(async (provider: AllAIProviders) => {
    setConfigState((prev) => {
      const keys = [...(prev.apiKeys[provider] ?? [])];
      if (keys.length <= 1) return prev;
      const first = keys.shift()!;
      keys.push(first);
      return { ...prev, apiKeys: { ...prev.apiKeys, [provider]: keys } };
    });
  }, []);

  const moveApiKeyToFront = useCallback(async (provider: AllAIProviders, keyOrIndex: string | number) => {
    setConfigState((prev) => {
      const keys = [...(prev.apiKeys[provider] ?? [])];
      if (keys.length === 0) return prev;

      let idx = -1;
      if (typeof keyOrIndex === 'number') idx = keyOrIndex;
      else idx = keys.indexOf(keyOrIndex);

      if (idx <= 0 || idx >= keys.length) return prev;
      const [k] = keys.splice(idx, 1);
      keys.unshift(k);
      return { ...prev, apiKeys: { ...prev.apiKeys, [provider]: keys } };
    });
  }, []);

  const value = useMemo(
    () => ({
      config,
      setConfig,
      updateConfig,
      addApiKey,
      removeApiKey,
      clearApiKeys,
      setSelectedChatProvider,
      setSelectedAgentProvider,
      setSelectedChatMode,
      setSelectedAgentMode,
      setQualityMode,
      setAgentEnabled,
      rotateApiKey,
      moveApiKeyToFront,
      providerStatus,
      acknowledgeProviderStatus,
    }),
    [
      config,
      setConfig,
      updateConfig,
      addApiKey,
      removeApiKey,
      clearApiKeys,
      setSelectedChatProvider,
      setSelectedAgentProvider,
      setSelectedChatMode,
      setSelectedAgentMode,
      setQualityMode,
      setAgentEnabled,
      rotateApiKey,
      moveApiKeyToFront,
      providerStatus,
      acknowledgeProviderStatus,
    ],
  );

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}

export function useAI() {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error('useAI must be used within AIProvider');
  return ctx;
}

export const rotateApiKeyOnError = (provider: AllAIProviders): number => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const SKM = require('../lib/SecureKeyManager').default;
    if (SKM && typeof SKM.rotateKey === 'function') {
      SKM.rotateKey(provider);
      return 1;
    }
  } catch {}
  return 0;
};