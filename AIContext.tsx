// contexts/AIContext.tsx
// ✅ MIGRATION FIX: Lädt alte Keys, falls V2 leer ist
// ✅ MODEL UPDATE: Nur noch starke Coder-Modelle (Qwen 2.5 Coder, DeepSeek)

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// -------------------------------------------------------------
// Provider & Model Typen
// -------------------------------------------------------------

export type AllAIProviders = 'groq' | 'gemini' | 'openai' | 'anthropic' | 'huggingface';
export type QualityMode = 'speed' | 'quality';
export type ModelRole = 'chat' | 'agent' | 'both';
export type BillingTier = 'free' | 'paid';

export type ModelInfo = {
  id: string;
  label: string;
  description?: string;
  role: ModelRole;
  billing: BillingTier;
};

export const PROVIDER_LABELS: Record<AllAIProviders, string> = {
  groq: 'Groq (High-Speed)',
  gemini: 'Gemini (Google)',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  huggingface: 'HuggingFace (Open Source)',
};

export const PROVIDER_DESCRIPTIONS: Record<AllAIProviders, string> = {
  groq: 'Extrem schnell für Inferenz. Ideal für iterative Code-Changes.',
  gemini: 'Großes Kontext-Fenster, gut für Analysen.',
  openai: 'Der Industriestandard für Qualität.',
  anthropic: 'Hervorragend bei komplexem Logic/Reasoning.',
  huggingface: 'Zugriff auf Top Open-Source Coder (Qwen, DeepSeek).',
};

// -------------------------------------------------------------
// Verfügbare Modelle (CLEANED UP & UPDATED)
// -------------------------------------------------------------

export const AVAILABLE_MODELS: Record<AllAIProviders, ModelInfo[]> = {
  groq: [
    {
      id: 'llama-3.3-70b-versatile',
      label: 'LLaMA 3.3 70B',
      description: 'Aktuell bestes Allround-Modell auf Groq.',
      role: 'both',
      billing: 'free',
    },
    {
      id: 'llama-3.1-8b-instant',
      label: 'LLaMA 3.1 8B',
      description: 'Super schnell, gut für kleine Fixes.',
      role: 'both',
      billing: 'free',
    },
    {
      id: 'mixtral-8x7b-32768',
      label: 'Mixtral 8x7B',
      description: 'Gutes Coding-Modell, großes Kontextfenster.',
      role: 'both',
      billing: 'free',
    },
  ],
  gemini: [
    {
      id: 'gemini-2.0-flash',
      label: 'Gemini 2.0 Flash',
      description: 'Sehr schnell & effizient.',
      role: 'both',
      billing: 'free',
    },
    {
      id: 'gemini-1.5-pro',
      label: 'Gemini 1.5 Pro',
      description: 'Höchste Qualität von Google, riesiges Kontextfenster.',
      role: 'both',
      billing: 'free',
    },
  ],
  openai: [
    {
      id: 'gpt-4o',
      label: 'GPT-4o',
      description: 'Schnell und sehr intelligent.',
      role: 'both',
      billing: 'paid',
    },
    {
      id: 'gpt-4o-mini',
      label: 'GPT-4o Mini',
      description: 'Günstig & schnell.',
      role: 'both',
      billing: 'paid',
    },
  ],
  anthropic: [
    {
      id: 'claude-3-5-sonnet-20241022',
      label: 'Claude 3.5 Sonnet',
      description: 'State-of-the-Art für Coding.',
      role: 'both',
      billing: 'paid',
    },
    {
      id: 'claude-3-5-haiku-20241022',
      label: 'Claude 3.5 Haiku',
      description: 'Schnellste Claude Variante.',
      role: 'both',
      billing: 'paid',
    },
  ],
  huggingface: [
    {
      id: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      label: 'Qwen 2.5 Coder 32B',
      description: 'Aktuell bestes Open-Source Coding Modell.',
      role: 'both',
      billing: 'free',
    },
    {
      id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B',
      label: 'DeepSeek R1 Distill',
      description: 'Starkes Reasoning Modell (Distilled).',
      role: 'both',
      billing: 'free',
    },
    {
      id: 'meta-llama/Llama-3.1-70B-Instruct',
      label: 'LLaMA 3.1 70B (HF)',
      description: 'Via HF Inference API.',
      role: 'both',
      billing: 'free',
    },
  ],
};

export type AIConfig = {
  selectedChatProvider: AllAIProviders;
  selectedAgentProvider: AllAIProviders;
  selectedChatMode: string;
  selectedAgentMode: string;
  qualityMode: QualityMode;
  apiKeys: Record<AllAIProviders, string[]>;
};

// -------------------------------------------------------------
// Keys & Env Helper
// -------------------------------------------------------------

const CONFIG_STORAGE_KEY_V1 = 'ai_config'; // Alter Key
const CONFIG_STORAGE_KEY_V2 = 'ai_config_v2'; // Neuer Key
const RUNTIME_GLOBALS_KEY = 'kiwi_ai_runtime_globals_v1';

function applyConfigToEnv(config: AIConfig) {
  try {
    const proc: any = typeof process !== 'undefined' ? process : {};
    const env = proc.env || (proc.env = {});
    (globalThis as any).__K1W1_AI_CONFIG = config;

    const mapping: Record<AllAIProviders, string[]> = {
      groq: ['GROQ_API_KEY', 'EXPO_PUBLIC_GROQ_API_KEY'],
      gemini: ['GEMINI_API_KEY', 'EXPO_PUBLIC_GEMINI_API_KEY'],
      openai: ['OPENAI_API_KEY', 'EXPO_PUBLIC_OPENAI_API_KEY'],
      anthropic: ['ANTHROPIC_API_KEY', 'EXPO_PUBLIC_ANTHROPIC_API_KEY'],
      huggingface: ['HUGGINGFACE_API_KEY', 'EXPO_PUBLIC_HF_API_KEY', 'HF_API_KEY'],
    };

    (Object.keys(mapping) as AllAIProviders[]).forEach((provider) => {
      const firstKey = config.apiKeys[provider]?.[0];
      const envNames = mapping[provider];

      if (firstKey?.trim()) {
        for (const name of envNames) {
          env[name] = firstKey.trim();
        }
      }
    });
  } catch (e) {
    console.warn('[AIContext] applyConfigToEnv Fehler', e);
  }
}

export type RuntimeGlobals = {
  lastProjectName?: string;
  lastBuildTime?: string;
  lastUsedModel?: string;
  [key: string]: any;
};

let runtimeGlobals: RuntimeGlobals = {};

export const getRuntimeGlobals = () => runtimeGlobals;

type RotateFn = (provider: AllAIProviders) => Promise<boolean>;
let rotateFunction: RotateFn | null = null;

export const setRotateFunction = (fn: RotateFn | null) => {
  rotateFunction = fn;
};
export const rotateApiKeyOnError = async (provider: AllAIProviders): Promise<boolean> => {
  if (!rotateFunction) return false;
  return rotateFunction(provider);
};

export function detectMetaFromConfig(
  provider: AllAIProviders,
  selectedModel: string,
  quality: QualityMode,
): { provider: AllAIProviders; model: string; quality: QualityMode } {
  // Wenn das Modell direkt in der Liste existiert, nimm es
  const available = AVAILABLE_MODELS[provider] || [];
  const found = available.find((m) => m.id === selectedModel);
  if (found) return { provider, model: found.id, quality };

  // Fallbacks falls "Auto" oder ungültig gewählt
  const fallback = available[0]?.id || selectedModel;
  return { provider, model: fallback, quality };
}

const DEFAULT_CONFIG: AIConfig = {
  selectedChatProvider: 'groq',
  selectedAgentProvider: 'groq',
  selectedChatMode: 'llama-3.3-70b-versatile',
  selectedAgentMode: 'llama-3.3-70b-versatile',
  qualityMode: 'speed',
  apiKeys: {
    groq: [],
    gemini: [],
    openai: [],
    anthropic: [],
    huggingface: [],
  },
};

export type AIContextValue = {
  config: AIConfig;
  isLoaded: boolean;
  setSelectedChatProvider: (p: AllAIProviders) => Promise<void>;
  setSelectedAgentProvider: (p: AllAIProviders) => Promise<void>;
  setSelectedChatMode: (modeId: string) => Promise<void>;
  setSelectedAgentMode: (modeId: string) => Promise<void>;
  setQualityMode: (mode: QualityMode) => Promise<void>;
  addApiKey: (provider: AllAIProviders, key: string) => Promise<void>;
  removeApiKey: (provider: AllAIProviders, key: string) => Promise<void>;
  rotateApiKey: (provider: AllAIProviders) => Promise<boolean>;
  moveApiKeyToFront: (provider: AllAIProviders, index: number) => Promise<void>;
};

export const AIContext = createContext<AIContextValue | undefined>(undefined);

// -------------------------------------------------------------
// Load/Save Logic with Migration
// -------------------------------------------------------------

async function loadConfigWithMigration(): Promise<AIConfig> {
  try {
    // 1. Versuche V2 zu laden
    const rawV2 = await AsyncStorage.getItem(CONFIG_STORAGE_KEY_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      // Merge mit Defaults für neue Felder
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        apiKeys: { ...DEFAULT_CONFIG.apiKeys, ...parsed.apiKeys },
      };
    }

    // 2. V2 nicht gefunden -> Suche V1 (MIGRATION)
    const rawV1 = await AsyncStorage.getItem(CONFIG_STORAGE_KEY_V1);
    if (rawV1) {
      console.log('[AIContext] ♻️ Migriere Konfiguration von V1 auf V2...');
      const parsedV1 = JSON.parse(rawV1);
      
      // Versuche alte Struktur auf neue zu mappen
      const migratedConfig: AIConfig = {
        ...DEFAULT_CONFIG,
        apiKeys: {
          ...DEFAULT_CONFIG.apiKeys,
          // Alte Config hatte oft einfache Strings oder Arrays, hier sicherstellen
          groq: Array.isArray(parsedV1.apiKeys?.groq) ? parsedV1.apiKeys.groq : [],
          openai: Array.isArray(parsedV1.apiKeys?.openai) ? parsedV1.apiKeys.openai : [],
          gemini: Array.isArray(parsedV1.apiKeys?.gemini) ? parsedV1.apiKeys.gemini : [],
          anthropic: Array.isArray(parsedV1.apiKeys?.anthropic) ? parsedV1.apiKeys.anthropic : [],
          huggingface: Array.isArray(parsedV1.apiKeys?.huggingface) ? parsedV1.apiKeys.huggingface : [],
        }
      };
      
      // Speichere sofort als V2
      await AsyncStorage.setItem(CONFIG_STORAGE_KEY_V2, JSON.stringify(migratedConfig));
      return migratedConfig;
    }

    return DEFAULT_CONFIG;
  } catch (e) {
    console.warn('[AIContext] Load Error, using defaults:', e);
    return DEFAULT_CONFIG;
  }
}

export const AIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load on mount
  useEffect(() => {
    loadConfigWithMigration().then((loaded) => {
      setConfig(loaded);
      applyConfigToEnv(loaded);
      setIsLoaded(true);
    });
  }, []);

  // Save on change
  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(CONFIG_STORAGE_KEY_V2, JSON.stringify(config)).catch((e) =>
      console.warn('Save Error', e)
    );
    applyConfigToEnv(config);
  }, [config, isLoaded]);

  const updateConfig = useCallback((patch: Partial<AIConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const setSelectedChatProvider = useCallback(async (provider: AllAIProviders) => {
    const modes = AVAILABLE_MODELS[provider] || [];
    updateConfig({
      selectedChatProvider: provider,
      selectedChatMode: modes[0]?.id || '',
    });
  }, [updateConfig]);

  const setSelectedAgentProvider = useCallback(async (provider: AllAIProviders) => {
    const modes = AVAILABLE_MODELS[provider] || [];
    updateConfig({
      selectedAgentProvider: provider,
      selectedAgentMode: modes[0]?.id || '',
    });
  }, [updateConfig]);

  const setSelectedChatMode = useCallback(async (id: string) => updateConfig({ selectedChatMode: id }), [updateConfig]);
  const setSelectedAgentMode = useCallback(async (id: string) => updateConfig({ selectedAgentMode: id }), [updateConfig]);
  const setQualityMode = useCallback(async (mode: QualityMode) => updateConfig({ qualityMode: mode }), [updateConfig]);

  const addApiKey = useCallback(async (provider: AllAIProviders, key: string) => {
    setConfig((prev) => {
      const current = prev.apiKeys[provider] || [];
      if (current.includes(key)) return prev;
      return { ...prev, apiKeys: { ...prev.apiKeys, [provider]: [...current, key] } };
    });
  }, []);

  const removeApiKey = useCallback(async (provider: AllAIProviders, key: string) => {
    setConfig((prev) => ({
      ...prev,
      apiKeys: { ...prev.apiKeys, [provider]: (prev.apiKeys[provider] || []).filter((k) => k !== key) },
    }));
  }, []);

  const rotateApiKey = useCallback(async (provider: AllAIProviders): Promise<boolean> => {
    let changed = false;
    setConfig((prev) => {
      const current = prev.apiKeys[provider] || [];
      if (current.length <= 1) return prev;
      const [first, ...rest] = current;
      changed = true;
      return { ...prev, apiKeys: { ...prev.apiKeys, [provider]: [...rest, first] } };
    });
    return changed;
  }, []);

  const moveApiKeyToFront = useCallback(async (provider: AllAIProviders, index: number) => {
    setConfig((prev) => {
      const current = [...(prev.apiKeys[provider] || [])];
      if (index < 0 || index >= current.length) return prev;
      const [item] = current.splice(index, 1);
      current.unshift(item);
      return { ...prev, apiKeys: { ...prev.apiKeys, [provider]: current } };
    });
  }, []);

  useEffect(() => {
    setRotateFunction(rotateApiKey);
    return () => setRotateFunction(null);
  }, [rotateApiKey]);

  const value: AIContextValue = {
    config,
    isLoaded,
    setSelectedChatProvider,
    setSelectedAgentProvider,
    setSelectedChatMode,
    setSelectedAgentMode,
    setQualityMode,
    addApiKey,
    removeApiKey,
    rotateApiKey,
    moveApiKeyToFront,
  };

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
};

export function useAI(): AIContextValue {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error('useAI must be used within AIProvider');
  return ctx;
}
