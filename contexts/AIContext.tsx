// contexts/AIContext.ts
// Zentraler AI-Context: Modelle, Provider, Key-Rotation & Runtime-Config

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';

// ======================================================================
// TYPES
// ======================================================================

export type AllAIProviders =
  | 'groq'
  | 'gemini'
  | 'google'
  | 'openai'
  | 'anthropic'
  | 'huggingface'
  | 'openrouter'
  | 'deepseek'
  | 'xai'
  | 'ollama';

export type QualityMode = 'speed' | 'quality';
export type BillingTier = 'free' | 'paid';

export interface ModelInfo {
  id: string;
  provider: AllAIProviders;
  label: string;
  description?: string;
  billing: BillingTier;
}

// ======================================================================
// LABELS / DESCRIPTIONS FÜR SETTINGS-SCREEN
// ======================================================================

export const PROVIDER_LABELS: Record<AllAIProviders, string> = {
  groq: 'Groq',
  gemini: 'Gemini',
  google: 'Google AI',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  huggingface: 'HuggingFace / OSS',
  openrouter: 'OpenRouter',
  deepseek: 'DeepSeek',
  xai: 'xAI (Grok)',
  ollama: 'Ollama (Lokal)',
};

export const PROVIDER_DESCRIPTIONS: Record<AllAIProviders, string> = {
  groq: 'Groq: schnelle LLaMA & OSS-Modelle (Developer-Tier oft kostenlos).',
  gemini: 'Google Gemini 2.x – gute Allround- & Coding-Modelle.',
  google: 'Google AI Studio – Gemini-Modelle direkt von Google.',
  openai: 'GPT-5.x / 4.1 – stabile Premium-Modelle.',
  anthropic: 'Claude-Familie – stark für lange Kontexte & Sicherheit.',
  huggingface: 'HuggingFace Router mit freien Open-Source-Coding-Modellen.',
  openrouter: 'OpenRouter – Multi-Provider mit einheitlicher API.',
  deepseek: 'DeepSeek – starke Reasoning- & Coding-Modelle.',
  xai: 'xAI Grok – leistungsstarkes Modell von xAI.',
  ollama: 'Ollama – lokale LLMs ohne Cloud.',
};

// ======================================================================
// DEINE MODEL-LISTE – 1:1 NACH DEINER BESCHREIBUNG
// ======================================================================

export const AVAILABLE_MODELS: Partial<Record<AllAIProviders, ModelInfo[]>> = {
  // ---------------------------------------------------
  // GROQ – LLaMA / OSS über Groq
  // ---------------------------------------------------
  groq: [
    {
      id: 'auto-groq',
      provider: 'groq',
      label: '🎯 Auto Groq',
      description: 'Wählt automatisch ein Groq-Modell je nach Quality-Mode.',
      billing: 'free',
    },
    {
      id: 'llama-3.1-8b-instant',
      provider: 'groq',
      label: 'llama-3.1-8b-instant',
      description: 'Sehr schnelles Modell für Alltags-Coding.',
      billing: 'free',
    },
    {
      id: 'llama-3.3-70b-versatile',
      provider: 'groq',
      label: 'llama-3.3-70b-versatile',
      description: 'Großes, starkes Modell für komplexe Projekte.',
      billing: 'free',
    },
    {
      id: 'gpt-oss-20b',
      provider: 'groq',
      label: 'gpt-oss-20b',
      description: 'Offenes 20B GPT-OSS-Modell.',
      billing: 'free',
    },
    {
      id: 'gpt-oss-120b',
      provider: 'groq',
      label: 'gpt-oss-120b',
      description: 'Großes Reasoning-/Tool-Use-Modell.',
      billing: 'free',
    },
    {
      id: 'qwen-3-32b',
      provider: 'groq',
      label: 'qwen-3-32b',
      description: 'Starkes 32B-Modell für Code + Reasoning.',
      billing: 'free',
    },
    {
      id: 'deepseek-r1-distill-llama-70b',
      provider: 'groq',
      label: 'deepseek-r1-distill-llama-70b',
      description: 'Reasoning-/Coding-Distill für Analyse & Debugging.',
      billing: 'free',
    },
  ],

  // ---------------------------------------------------
  // GEMINI – 2.x Familie
  // ---------------------------------------------------
  gemini: [
    {
      id: 'auto-gemini',
      provider: 'gemini',
      label: '🎯 Auto Gemini',
      description: 'Wählt automatisch ein Gemini-Modell je nach Quality-Mode.',
      billing: 'free',
    },
    {
      id: 'gemini-2.5-flash',
      provider: 'gemini',
      label: 'gemini-2.5-flash',
      description: 'Sehr schnell & günstig.',
      billing: 'free',
    },
    {
      id: 'gemini-2.5-flash-lite',
      provider: 'gemini',
      label: 'gemini-2.5-flash-lite',
      description: 'Leicht & sparsam für Free-Tier.',
      billing: 'free',
    },
    {
      id: 'gemini-2.5-pro',
      provider: 'gemini',
      label: 'gemini-2.5-pro',
      description: 'Starkes Modell mit großem Kontext.',
      billing: 'free',
    },
    {
      id: 'gemini-2.0-flash',
      provider: 'gemini',
      label: 'gemini-2.0-flash',
      description: 'Vorläufer der 2.5er-Generation.',
      billing: 'free',
    },
  ],

  // ---------------------------------------------------
  // OPENAI – GPT-5.x / 4.1 Familie
  // ---------------------------------------------------
  openai: [
    {
      id: 'auto-openai',
      provider: 'openai',
      label: '🎯 Auto OpenAI',
      description:
        'Wählt automatisch ein passendes GPT-Modell je nach Quality-Mode.',
      billing: 'paid',
    },
    {
      id: 'gpt-5-mini',
      provider: 'openai',
      label: 'gpt-5-mini',
      description: 'Sehr schnell & günstig.',
      billing: 'paid',
    },
    {
      id: 'gpt-5.1',
      provider: 'openai',
      label: 'gpt-5.1',
      description: 'Starkes General-Purpose-Modell.',
      billing: 'paid',
    },
    {
      id: 'gpt-4.1-mini',
      provider: 'openai',
      label: 'gpt-4.1-mini',
      description: 'Mini-Allrounder für Experimente.',
      billing: 'paid',
    },
    {
      id: 'gpt-4.1',
      provider: 'openai',
      label: 'gpt-4.1',
      description: 'Stabiler Klassiker.',
      billing: 'paid',
    },
  ],

  // ---------------------------------------------------
  // ANTHROPIC – Claude Familie
  // ---------------------------------------------------
  anthropic: [
    {
      id: 'auto-anthropic',
      provider: 'anthropic',
      label: '🎯 Auto Anthropic',
      description:
        'Wählt automatisch ein Claude-Modell passend zu deinem Quality-Mode.',
      billing: 'paid',
    },
    {
      id: 'claude-3-5-haiku-20241022',
      provider: 'anthropic',
      label: 'claude-3-5-haiku-20241022',
      description: 'Schnelles Claude-Modell.',
      billing: 'paid',
    },
    {
      id: 'claude-3-7-sonnet-20250219',
      provider: 'anthropic',
      label: 'claude-3-7-sonnet-20250219',
      description: 'Balance aus Power & Kosten.',
      billing: 'paid',
    },
    {
      id: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      label: 'claude-sonnet-4-20250514',
      description: 'Neuere Sonnet-Generation.',
      billing: 'paid',
    },
    {
      id: 'claude-opus-4-1-20250805',
      provider: 'anthropic',
      label: 'claude-opus-4-1-20250805',
      description: 'Maximale Power für schwere Probleme.',
      billing: 'paid',
    },
  ],

  // ---------------------------------------------------
  // HUGGINGFACE / OSS – Open Weights (aktuelle Coding-Modelle)
  // ---------------------------------------------------
  huggingface: [
    {
      id: 'auto-hf',
      provider: 'huggingface',
      label: '🎯 Auto HF (OSS)',
      description:
        'Wählt automatisch ein OSS-Coding-Modell je nach Quality-Mode.',
      billing: 'free',
    },
    {
      id: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      provider: 'huggingface',
      label: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      description: 'Starkes OSS-Coding-Modell.',
      billing: 'free',
    },
    {
      id: 'deepseek-ai/DeepSeek-V3.2',
      provider: 'huggingface',
      label: 'deepseek-ai/DeepSeek-V3.2',
      description: 'Reasoning-starkes Open-Model.',
      billing: 'free',
    },
    {
      id: 'mistralai/Mistral-Nemo-Instruct-2407',
      provider: 'huggingface',
      label: 'mistralai/Mistral-Nemo-Instruct-2407',
      description: 'Flottes OSS-Modell.',
      billing: 'free',
    },
    {
      id: 'microsoft/Phi-4',
      provider: 'huggingface',
      label: 'microsoft/Phi-4',
      description: 'Kompaktes, effizientes OSS-Modell.',
      billing: 'free',
    },
    {
      id: 'gpt-oss-20b',
      provider: 'huggingface',
      label: 'gpt-oss-20b (HF)',
      description: 'GPT OSS 20B als OSS-Variante.',
      billing: 'free',
    },
  ],

  // ---------------------------------------------------
  // GOOGLE AI – Alias für Gemini
  // ---------------------------------------------------
  google: [
    {
      id: 'auto-google',
      provider: 'google',
      label: '🎯 Auto Google',
      description: 'Wählt automatisch ein Google-Modell je nach Quality-Mode.',
      billing: 'free',
    },
    {
      id: 'gemini-2.5-flash',
      provider: 'google',
      label: 'gemini-2.5-flash',
      description: 'Schnelles Gemini-Modell.',
      billing: 'free',
    },
  ],

  // ---------------------------------------------------
  // OPENROUTER – Multi-Provider
  // ---------------------------------------------------
  openrouter: [
    {
      id: 'auto-openrouter',
      provider: 'openrouter',
      label: '🎯 Auto OpenRouter',
      description: 'Automatische Modell-Auswahl über OpenRouter.',
      billing: 'paid',
    },
  ],

  // ---------------------------------------------------
  // DEEPSEEK – Reasoning & Coding
  // ---------------------------------------------------
  deepseek: [
    {
      id: 'auto-deepseek',
      provider: 'deepseek',
      label: '🎯 Auto DeepSeek',
      description: 'Automatische DeepSeek Modell-Auswahl.',
      billing: 'paid',
    },
    {
      id: 'deepseek-chat',
      provider: 'deepseek',
      label: 'deepseek-chat',
      description: 'DeepSeek Chat-Modell.',
      billing: 'paid',
    },
    {
      id: 'deepseek-coder',
      provider: 'deepseek',
      label: 'deepseek-coder',
      description: 'DeepSeek Coding-Modell.',
      billing: 'paid',
    },
  ],

  // ---------------------------------------------------
  // XAI – Grok
  // ---------------------------------------------------
  xai: [
    {
      id: 'auto-xai',
      provider: 'xai',
      label: '🎯 Auto xAI',
      description: 'Automatische xAI Grok Modell-Auswahl.',
      billing: 'paid',
    },
    {
      id: 'grok-2',
      provider: 'xai',
      label: 'grok-2',
      description: 'Grok 2 von xAI.',
      billing: 'paid',
    },
  ],

  // ---------------------------------------------------
  // OLLAMA – Lokal
  // ---------------------------------------------------
  ollama: [
    {
      id: 'auto-ollama',
      provider: 'ollama',
      label: '🎯 Auto Ollama',
      description: 'Automatische lokale Modell-Auswahl.',
      billing: 'free',
    },
    {
      id: 'llama3.2',
      provider: 'ollama',
      label: 'llama3.2',
      description: 'Llama 3.2 lokal via Ollama.',
      billing: 'free',
    },
    {
      id: 'codellama',
      provider: 'ollama',
      label: 'codellama',
      description: 'Code Llama lokal via Ollama.',
      billing: 'free',
    },
  ],
};

// ======================================================================
// RUNTIME-KONFIG FÜR ORCHESTRATOR (__K1W1_AI_CONFIG)
// ======================================================================

type ProviderDefaults = {
  groq?: { speed?: string; quality?: string };
  gemini?: { speed?: string; quality?: string };
  openai?: { speed?: string; quality?: string };
  anthropic?: { speed?: string; quality?: string };
  huggingface?: { speed?: string; quality?: string };
};

type ApiConfig = {
  apiKeys?: Partial<Record<AllAIProviders, string[]>>;
  defaults?: ProviderDefaults;
};

(function ensureRuntimeConfig() {
  const g = globalThis as any;
  if (!g.__K1W1_AI_CONFIG) {
    const apiCfg: ApiConfig = {
      apiKeys: {
        // hier landen deine Keys zur Laufzeit (SettingsScreen)
      },
      defaults: {
        groq: {
          speed: 'llama-3.1-8b-instant',
          quality: 'llama-3.3-70b-versatile',
        },
        gemini: {
          speed: 'gemini-2.5-flash',
          quality: 'gemini-2.5-pro',
        },
        openai: {
          speed: 'gpt-5-mini',
          quality: 'gpt-5.1',
        },
        anthropic: {
          speed: 'claude-3-5-haiku-20241022',
          quality: 'claude-sonnet-4-20250514',
        },
        huggingface: {
          // Auto-HF = diese zwei Modelle steuern den Modus:
          speed: 'deepseek-ai/DeepSeek-V3.2',
          quality: 'Qwen/Qwen2.5-Coder-32B-Instruct',
        },
      },
    };
    g.__K1W1_AI_CONFIG = apiCfg;
  }
})();

// ======================================================================
// detectMetaFromConfig – Auto-Modi → echte Modellnamen
// ======================================================================

export function detectMetaFromConfig(
  provider: AllAIProviders,
  selectedModel: string,
  quality: QualityMode,
): { provider: AllAIProviders; model: string; quality: QualityMode } {
  const g = globalThis as any;
  const cfg: ApiConfig = g.__K1W1_AI_CONFIG || {};
  const defaults: ProviderDefaults = cfg.defaults || {};

  const pickDefault = (): string => {
    switch (provider) {
      case 'groq':
        return (
          defaults.groq?.[quality] ||
          (quality === 'speed'
            ? 'llama-3.1-8b-instant'
            : 'llama-3.3-70b-versatile')
        );
      case 'gemini':
        return (
          defaults.gemini?.[quality] ||
          (quality === 'speed' ? 'gemini-2.5-flash' : 'gemini-2.5-pro')
        );
      case 'openai':
        return (
          defaults.openai?.[quality] ||
          (quality === 'speed' ? 'gpt-5-mini' : 'gpt-5.1')
        );
      case 'anthropic':
        return (
          defaults.anthropic?.[quality] ||
          (quality === 'speed'
            ? 'claude-3-5-haiku-20241022'
            : 'claude-sonnet-4-20250514')
        );
      case 'huggingface':
      default:
        return (
          defaults.huggingface?.[quality] ||
          (quality === 'speed'
            ? 'deepseek-ai/DeepSeek-V3.2'
            : 'Qwen/Qwen2.5-Coder-32B-Instruct')
        );
    }
  };

  const m = (selectedModel || '').trim();

  // Deine Auto-Modi: auto-groq, auto-gemini, auto-openai, auto-anthropic, auto-hf
  if (!m || /^auto(-|$)/i.test(m)) {
    return {
      provider,
      model: pickDefault(),
      quality,
    };
  }

  // explizit gewähltes Modell (egal von welchem Provider) einfach durchreichen
  return {
    provider,
    model: m,
    quality,
  };
}

// ======================================================================
// rotateApiKeyOnError – vom Orchestrator bei 401/429 etc. genutzt
// ======================================================================

export async function rotateApiKeyOnError(
  provider: AllAIProviders,
): Promise<boolean> {
  const g = globalThis as any;
  const cfg: ApiConfig = g.__K1W1_AI_CONFIG || {};
  const store = cfg.apiKeys || {};
  const list = store[provider];

  if (!Array.isArray(list) || list.length < 2) {
    return false;
  }

  const [first, ...rest] = list;
  const rotated = [...rest, first];

  if (!g.__K1W1_AI_CONFIG) g.__K1W1_AI_CONFIG = {};
  if (!g.__K1W1_AI_CONFIG.apiKeys) g.__K1W1_AI_CONFIG.apiKeys = {};
  g.__K1W1_AI_CONFIG.apiKeys[provider] = rotated;

  return true;
}

// ======================================================================
// REACT-CONTEXT: CONFIG + KEY-MANAGEMENT FÜR SETTINGS-SCREEN
// ======================================================================

export interface AIConfig {
  selectedChatProvider: AllAIProviders;
  selectedAgentProvider: AllAIProviders;
  selectedChatMode: string;
  selectedAgentMode: string;
  qualityMode: QualityMode;
  apiKeys: Partial<Record<AllAIProviders, string[]>>;
}

interface AIContextValue {
  config: AIConfig;
  setSelectedChatProvider: (p: AllAIProviders) => void;
  setSelectedAgentProvider: (p: AllAIProviders) => void;
  setSelectedChatMode: (modeId: string) => void;
  setSelectedAgentMode: (modeId: string) => void;
  setQualityMode: (mode: QualityMode) => Promise<void>;
  addApiKey: (provider: AllAIProviders, key: string) => Promise<void>;
  removeApiKey: (provider: AllAIProviders, key: string) => Promise<void>;
  rotateApiKey: (provider: AllAIProviders) => Promise<boolean>;
  moveApiKeyToFront: (
    provider: AllAIProviders,
    index: number,
  ) => Promise<void>;
}

const AIContext = createContext<AIContextValue | undefined>(undefined);

function readInitialConfig(): AIConfig {
  const g = globalThis as any;
  const apiCfg: ApiConfig = g.__K1W1_AI_CONFIG || {};
  const apiKeys = apiCfg.apiKeys || {};

  return {
    selectedChatProvider: 'groq',
    selectedAgentProvider: 'groq',
    selectedChatMode: 'auto-groq',
    selectedAgentMode: 'auto-groq',
    qualityMode: 'speed',
    apiKeys,
  };
}

function writeApiKeysToGlobal(
  apiKeys: Partial<Record<AllAIProviders, string[]>>,
) {
  const g = globalThis as any;
  if (!g.__K1W1_AI_CONFIG) g.__K1W1_AI_CONFIG = {};
  if (!g.__K1W1_AI_CONFIG.apiKeys) g.__K1W1_AI_CONFIG.apiKeys = {};
  g.__K1W1_AI_CONFIG.apiKeys = {
    ...g.__K1W1_AI_CONFIG.apiKeys,
    ...apiKeys,
  };
}

interface AIProviderProps {
  children: ReactNode;
}

export const AIProvider: React.FC<AIProviderProps> = ({ children }) => {
  const [config, setConfig] = useState<AIConfig>(() => readInitialConfig());

  // API-Keys immer auch im globalen Config-Objekt spiegeln,
  // damit der Orchestrator sie findet.
  useEffect(() => {
    writeApiKeysToGlobal(config.apiKeys);
  }, [config.apiKeys]);

  const setSelectedChatProvider = (provider: AllAIProviders) => {
    setConfig((prev) => ({
      ...prev,
      selectedChatProvider: provider,
    }));
  };

  const setSelectedAgentProvider = (provider: AllAIProviders) => {
    setConfig((prev) => ({
      ...prev,
      selectedAgentProvider: provider,
    }));
  };

  const setSelectedChatMode = (modeId: string) => {
    setConfig((prev) => ({
      ...prev,
      selectedChatMode: modeId,
    }));
  };

  const setSelectedAgentMode = (modeId: string) => {
    setConfig((prev) => ({
      ...prev,
      selectedAgentMode: modeId,
    }));
  };

  const setQualityMode = async (mode: QualityMode): Promise<void> => {
    setConfig((prev) => ({
      ...prev,
      qualityMode: mode,
    }));
  };

  const addApiKey = async (
    provider: AllAIProviders,
    key: string,
  ): Promise<void> => {
    const trimmed = key.trim();
    if (!trimmed) return;

    setConfig((prev) => {
      const list = prev.apiKeys[provider] ?? [];
      if (list.includes(trimmed)) return prev;
      return {
        ...prev,
        apiKeys: {
          ...prev.apiKeys,
          [provider]: [...list, trimmed],
        },
      };
    });
  };

  const removeApiKey = async (
    provider: AllAIProviders,
    key: string,
  ): Promise<void> => {
    setConfig((prev) => {
      const list = prev.apiKeys[provider] ?? [];
      const nextList = list.filter((k) => k !== key);
      return {
        ...prev,
        apiKeys: {
          ...prev.apiKeys,
          [provider]: nextList,
        },
      };
    });
  };

  const rotateApiKey = async (provider: AllAIProviders): Promise<boolean> => {
    let rotated = false;

    setConfig((prev) => {
      const list = prev.apiKeys[provider] ?? [];
      if (list.length < 2) return prev;

      const [first, ...rest] = list;
      const rotatedList = [...rest, first];
      rotated = true;

      return {
        ...prev,
        apiKeys: {
          ...prev.apiKeys,
          [provider]: rotatedList,
        },
      };
    });

    if (rotated) {
      await rotateApiKeyOnError(provider);
      return true;
    }
    return false;
  };

  const moveApiKeyToFront = async (
    provider: AllAIProviders,
    index: number,
  ): Promise<void> => {
    setConfig((prev) => {
      const list = prev.apiKeys[provider] ?? [];
      if (index <= 0 || index >= list.length) return prev;

      const key = list[index];
      const remaining = list.filter((_, i) => i !== index);
      const nextList = [key, ...remaining];

      return {
        ...prev,
        apiKeys: {
          ...prev.apiKeys,
          [provider]: nextList,
        },
      };
    });
  };

  const value: AIContextValue = {
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
  };

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
};

export function useAI(): AIContextValue {
  const ctx = useContext(AIContext);
  if (!ctx) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return ctx;
}
