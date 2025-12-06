// contexts/AIContext.tsx - MIT LOAD-QUEUE UND RACE-CONDITION FIX
// ✅ Verhindert parallele Load/Save-Operationen
// ✅ Load-Queue für sequentielles Laden
// ✅ Atomic Updates mit Transaction-Logik
// ✅ Save-Await-Semantik: parallele Saves warten sauber auf den laufenden Zyklus

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

export type AllAIProviders =
  | 'groq'
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'huggingface';
export type QualityMode = 'speed' | 'quality';
export type ModelRole = 'chat' | 'agent' | 'both';
export type BillingTier = 'free' | 'paid';

export type ModelInfo = {
  id: string;
  label: string;
  description?: string;
  role: ModelRole;
  billing: BillingTier; // FREE / PAID Anzeige
};

export const PROVIDER_LABELS: Record<AllAIProviders, string> = {
  groq: 'Groq (Schnell & günstig)',
  gemini: 'Gemini (Google)',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  huggingface: 'HuggingFace / OSS',
};

export const PROVIDER_DESCRIPTIONS: Record<AllAIProviders, string> = {
  groq: 'Sehr schnelle, günstige Inferenz – perfekt für Builds & Coding.',
  gemini: 'Google Gemini – gute Qualität, kostenloses Kontingent.',
  openai: 'OpenAI GPT-Modelle – beste Qualität, aber kostenpflichtig.',
  anthropic: 'Claude-Modelle – stark für Reasoning & Sicherheit, kostenpflichtig.',
  huggingface: 'OSS-Modelle über HF / Self-Host – flexibel und oft kostenlos.',
};

// -------------------------------------------------------------
// Verfügbare Modelle pro Provider (+ Billing FREE/PAID)
// -------------------------------------------------------------

export const AVAILABLE_MODELS: Record<AllAIProviders, ModelInfo[]> = {
  // ---------------------- GROQ ----------------------
  groq: [
    {
      id: 'auto-groq',
      label: '🎯 Auto (Groq Empfehlung)',
      description: 'Wählt je nach Quality-Mode automatisch ein Groq-Modell.',
      role: 'both',
      billing: 'free',
    },
    {
      id: 'llama-3.1-8b-instant',
      label: 'LLaMA 3.1 8B Instant',
      description: 'Sehr schnell & günstig – ideal für Speed-Builds und Tests.',
      role: 'both',
      billing: 'free',
    },
    {
      id: 'llama-3.1-70b-versatile',
      label: 'LLaMA 3.1 70B Versatile',
      description: 'Deutlich bessere Qualität – ideal für komplexe Tasks.',
      role: 'both',
      billing: 'paid',
    },
  ],

  // ---------------------- GEMINI ----------------------
  gemini: [
    {
      id: 'auto-gemini',
      label: '🎯 Auto (Gemini Empfehlung)',
      description:
        'Wählt je nach Quality-Mode automatisch ein Gemini-Modell.',
      role: 'both',
      billing: 'free',
    },
    {
      id: 'gemini-2.5-flash',
      label: 'Gemini 2.5 Flash',
      description: 'Schnell, günstig – ideal für Speed.',
      role: 'both',
      billing: 'free',
    },
    {
      id: 'gemini-2.5-pro',
      label: 'Gemini 2.5 Pro',
      description: 'Top-Qualität, stärker für Reasoning.',
      role: 'both',
      billing: 'paid',
    },
  ],

  // ---------------------- OPENAI ----------------------
  openai: [
    {
      id: 'auto-openai',
      label: '🎯 Auto (OpenAI Empfehlung)',
      description:
        'Wählt je nach Quality-Mode automatisch ein OpenAI-Modell.',
      role: 'both',
      billing: 'paid',
    },
    {
      id: 'gpt-5.1-mini',
      label: 'GPT-5.1 Mini',
      description: 'Schneller & günstiger – ideal für Speed.',
      role: 'both',
      billing: 'paid',
    },
    {
      id: 'gpt-5.1',
      label: 'GPT-5.1',
      description: 'Beste Qualität – ideal für komplexe Aufgaben.',
      role: 'both',
      billing: 'paid',
    },
  ],

  // ---------------------- ANTHROPIC ----------------------
  anthropic: [
    {
      id: 'auto-anthropic',
      label: '🎯 Auto (Claude Empfehlung)',
      description:
        'Wählt je nach Quality-Mode automatisch ein Claude-Modell.',
      role: 'both',
      billing: 'paid',
    },
    {
      id: 'claude-3.5-haiku',
      label: 'Claude 3.5 Haiku',
      description: 'Schnell – ideal für Speed.',
      role: 'both',
      billing: 'paid',
    },
    {
      id: 'claude-3.5-sonnet',
      label: 'Claude 3.5 Sonnet',
      description: 'Stärkeres Reasoning – ideal für Quality.',
      role: 'both',
      billing: 'paid',
    },
  ],

  // ---------------------- HUGGINGFACE / OSS ----------------------
  huggingface: [
    {
      id: 'auto-huggingface',
      label: '🎯 Auto (OSS Empfehlung)',
      description:
        'Wählt je nach Quality-Mode automatisch ein OSS-Modell.',
      role: 'both',
      billing: 'free',
    },
    {
      id: 'Qwen/Qwen2.5-7B-Instruct',
      label: 'Qwen 2.5 7B Instruct',
      description: 'Schnell & leichtgewichtig – ideal für Speed.',
      role: 'both',
      billing: 'free',
    },
    {
      id: 'Qwen/Qwen2.5-32B-Instruct',
      label: 'Qwen 2.5 32B Instruct',
      description: 'Deutlich stärker – ideal für Quality.',
      role: 'both',
      billing: 'free',
    },
  ],
};

// -------------------------------------------------------------
// Auto-Modellauflösung abhängig von Quality-Mode
// -------------------------------------------------------------

function resolveAutoModel(
  provider: AllAIProviders,
  selectedModel: string,
  quality: QualityMode,
): { provider: AllAIProviders; model: string; quality: QualityMode } {
  switch (provider) {
    case 'groq': {
      const model =
        quality === 'quality'
          ? 'llama-3.1-70b-versatile'
          : 'llama-3.1-8b-instant';
      return { provider: 'groq', model, quality };
    }
    case 'gemini': {
      const model =
        quality === 'quality' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
      return { provider: 'gemini', model, quality };
    }
    case 'openai': {
      const model = quality === 'quality' ? 'gpt-5.1' : 'gpt-5.1-mini';
      return { provider: 'openai', model, quality };
    }
    case 'anthropic': {
      const model =
        quality === 'quality' ? 'claude-3.5-sonnet' : 'claude-3.5-haiku';
      return { provider: 'anthropic', model, quality };
    }
    case 'huggingface': {
      const model =
        quality === 'quality'
          ? 'Qwen/Qwen2.5-32B-Instruct'
          : 'Qwen/Qwen2.5-7B-Instruct';
      return { provider: 'huggingface', model, quality };
    }
    default: {
      return { provider, model: selectedModel, quality };
    }
  }
}

// -------------------------------------------------------------
// Default-Config
// -------------------------------------------------------------

export type AIConfig = {
  selectedChatProvider: AllAIProviders;
  selectedAgentProvider: AllAIProviders;
  selectedChatMode: string;
  selectedAgentMode: string;
  qualityMode: QualityMode;
  apiKeys: Record<AllAIProviders, string[]>;
};

const DEFAULT_CONFIG: AIConfig = {
  selectedChatProvider: 'groq',
  selectedAgentProvider: 'groq',
  selectedChatMode: 'llama-3.1-8b-instant',
  selectedAgentMode: 'llama-3.1-8b-instant',
  qualityMode: 'speed',
  apiKeys: {
    groq: [],
    gemini: [],
    openai: [],
    anthropic: [],
    huggingface: [],
  },
};

// -------------------------------------------------------------
// Context Typen
// -------------------------------------------------------------

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
// LOAD-QUEUE für Race-Condition Prevention
// -------------------------------------------------------------

type LoadTask = () => Promise<void>;
const loadQueue: LoadTask[] = [];
let isProcessingQueue = false;

async function processLoadQueue(): Promise<void> {
  if (isProcessingQueue || loadQueue.length === 0) return;

  isProcessingQueue = true;

  try {
    while (loadQueue.length > 0) {
      const task = loadQueue.shift();
      if (task) {
        await task();
      }
    }
  } finally {
    isProcessingQueue = false;
  }
}

function enqueueLoadTask(task: LoadTask): void {
  loadQueue.push(task);
  if (!isProcessingQueue) {
    void processLoadQueue();
  }
}

// -------------------------------------------------------------
// Storage Keys
// -------------------------------------------------------------

const CONFIG_STORAGE_KEY = 'K1W1_AI_CONFIG_V1';
const RUNTIME_GLOBALS_KEY = 'K1W1_RUNTIME_GLOBALS_V1';

// -------------------------------------------------------------
// Runtime Globals
// -------------------------------------------------------------

type RuntimeGlobals = Record<string, unknown>;
let runtimeGlobals: RuntimeGlobals = {};

// -------------------------------------------------------------
// Env-Applikation (für späteres Provider-Handling)
// -------------------------------------------------------------

function applyConfigToEnv(config: AIConfig) {
  // Hier könntest du z.B. globale Provider-Defaults setzen,
  // falls du später ein zentrales API-Layer nutzt.
  void config;
}

// -------------------------------------------------------------
// Storage-Helper mit Queue
// -------------------------------------------------------------

async function loadConfigFromStorage(): Promise<AIConfig> {
  return new Promise((resolve) => {
    const task: LoadTask = async () => {
      try {
        const raw = await AsyncStorage.getItem(CONFIG_STORAGE_KEY);
        if (!raw) {
          applyConfigToEnv(DEFAULT_CONFIG);
          resolve(DEFAULT_CONFIG);
          return;
        }

        const parsed = JSON.parse(raw) as AIConfig;

        const apiKeys: AIConfig['apiKeys'] = {
          groq: parsed.apiKeys?.groq ?? [],
          gemini: parsed.apiKeys?.gemini ?? [],
          openai: parsed.apiKeys?.openai ?? [],
          anthropic: parsed.apiKeys?.anthropic ?? [],
          huggingface: parsed.apiKeys?.huggingface ?? [],
        };

        const merged: AIConfig = {
          ...DEFAULT_CONFIG,
          ...parsed,
          apiKeys,
        };

        applyConfigToEnv(merged);
        resolve(merged);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(
          '[AIContext] Fehler beim Laden der Config, nutze Defaults',
          e,
        );
        applyConfigToEnv(DEFAULT_CONFIG);
        resolve(DEFAULT_CONFIG);
      }
    };

    enqueueLoadTask(task);
  });
}

// Atomic Save mit Lock-Mechanismus
let isSaving = false;
let pendingSave: AIConfig | null = null;

// Damit Aufrufer echte Await-Semantik haben können:
let currentSavePromise: Promise<void> | null = null;
let resolveCurrentSave: (() => void) | null = null;

async function saveConfigToStorage(config: AIConfig): Promise<void> {
  // Immer den neuesten Stand merken
  pendingSave = config;

  // Wenn gerade ein Save läuft, hänge dich an das laufende Promise
  if (isSaving) {
    return currentSavePromise ?? Promise.resolve();
  }

  isSaving = true;

  // Sammel-Promise für alle, die auf diesen Save-Zyklus warten wollen
  currentSavePromise = new Promise<void>((resolve) => {
    resolveCurrentSave = resolve;
  });

  try {
    while (pendingSave) {
      const nextConfig = pendingSave;
      pendingSave = null;

      applyConfigToEnv(nextConfig);
      await AsyncStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(nextConfig));
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[AIContext] Fehler beim Speichern der Config', e);
    // Bei Fehler pendingSave verwerfen, um Endlos-Loops zu vermeiden
    pendingSave = null;
  } finally {
    isSaving = false;

    // Alle wartenden Aufrufer freigeben
    if (resolveCurrentSave) {
      resolveCurrentSave();
    }
    resolveCurrentSave = null;
    currentSavePromise = null;
  }
}

async function loadRuntimeGlobals(): Promise<RuntimeGlobals> {
  return new Promise((resolve) => {
    const task: LoadTask = async () => {
      try {
        const raw = await AsyncStorage.getItem(RUNTIME_GLOBALS_KEY);
        if (!raw) {
          resolve({});
          return;
        }
        resolve(JSON.parse(raw) as RuntimeGlobals);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[AIContext] Fehler beim Laden der Runtime-Globals', e);
        resolve({});
      }
    };

    enqueueLoadTask(task);
  });
}

async function saveRuntimeGlobals(globals: RuntimeGlobals): Promise<void> {
  const task: LoadTask = async () => {
    try {
      await AsyncStorage.setItem(RUNTIME_GLOBALS_KEY, JSON.stringify(globals));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[AIContext] Fehler beim Speichern der Runtime-Globals', e);
    }
  };

  enqueueLoadTask(task);
}

// -------------------------------------------------------------
// Provider-Komponente
// -------------------------------------------------------------

export const AIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG);
  const [isLoaded, setIsLoaded] = useState(false);

  const isMountedRef = useRef(true);

  // Load config on mount
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [loadedConfig, loadedGlobals] = await Promise.all([
          loadConfigFromStorage(),
          loadRuntimeGlobals(),
        ]);

        if (!mounted) return;

        setConfig(loadedConfig);
        runtimeGlobals = loadedGlobals;
        setIsLoaded(true);

        // eslint-disable-next-line no-console
        console.log('[AIContext] 🔄 Runtime-Globals aktualisiert');
        // eslint-disable-next-line no-console
        console.log('[AIContext] ✅ AI-Config geladen');
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[AIContext] Fehler beim Laden:', error);
        if (mounted) {
          setIsLoaded(true);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
      isMountedRef.current = false;
    };
  }, []);

  // Save config when it changes
  useEffect(() => {
    if (!isLoaded) return;
    void saveConfigToStorage(config);
  }, [config, isLoaded]);

  // Save runtime globals periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (Object.keys(runtimeGlobals).length > 0) {
        void saveRuntimeGlobals(runtimeGlobals);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const updateConfig = useCallback((patch: Partial<AIConfig>) => {
    if (!isMountedRef.current) return;
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const setSelectedChatProvider = useCallback(
    async (provider: AllAIProviders) => {
      const modes = AVAILABLE_MODELS[provider] || [];
      const fallbackMode =
        modes.find((m) => m.id === 'auto-' + provider) ?? modes[0];

      updateConfig({
        selectedChatProvider: provider,
        selectedChatMode: fallbackMode?.id ?? 'auto-' + provider,
      });
    },
    [updateConfig],
  );

  const setSelectedAgentProvider = useCallback(
    async (provider: AllAIProviders) => {
      const modes = AVAILABLE_MODELS[provider] || [];
      const fallbackMode =
        modes.find((m) => m.id === 'auto-' + provider) ?? modes[0];

      updateConfig({
        selectedAgentProvider: provider,
        selectedAgentMode: fallbackMode?.id ?? 'auto-' + provider,
      });
    },
    [updateConfig],
  );

  const setSelectedChatMode = useCallback(
    async (modeId: string) => {
      updateConfig({ selectedChatMode: modeId });
    },
    [updateConfig],
  );

  const setSelectedAgentMode = useCallback(
    async (modeId: string) => {
      updateConfig({ selectedAgentMode: modeId });
    },
    [updateConfig],
  );

  const setQualityMode = useCallback(
    async (mode: QualityMode) => {
      updateConfig({ qualityMode: mode });
    },
    [updateConfig],
  );

  const addApiKey = useCallback(
    async (provider: AllAIProviders, key: string) => {
      setConfig((prev) => {
        const current = prev.apiKeys[provider] || [];
        if (current.includes(key)) return prev;

        const apiKeys = {
          ...prev.apiKeys,
          [provider]: [...current, key],
        };

        return { ...prev, apiKeys };
      });
    },
    [],
  );

  const removeApiKey = useCallback(
    async (provider: AllAIProviders, key: string) => {
      setConfig((prev) => {
        const current = prev.apiKeys[provider] || [];
        const apiKeys = {
          ...prev.apiKeys,
          [provider]: current.filter((k) => k !== key),
        };
        return { ...prev, apiKeys };
      });
    },
    [],
  );

  const rotateApiKey = useCallback(
    async (provider: AllAIProviders) => {
      let rotated = false;

      setConfig((prev) => {
        const current = prev.apiKeys[provider] || [];
        if (current.length <= 1) return prev;

        const [first, ...rest] = current;
        const apiKeys = {
          ...prev.apiKeys,
          [provider]: [...rest, first],
        };

        rotated = true;
        return { ...prev, apiKeys };
      });

      return rotated;
    },
    [],
  );

  const moveApiKeyToFront = useCallback(
    async (provider: AllAIProviders, index: number) => {
      setConfig((prev) => {
        const current = prev.apiKeys[provider] || [];
        if (index < 0 || index >= current.length) return prev;

        const key = current[index];
        const rest = current.filter((_, i) => i !== index);

        const apiKeys = {
          ...prev.apiKeys,
          [provider]: [key, ...rest],
        };

        return { ...prev, apiKeys };
      });
    },
    [],
  );

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

// -------------------------------------------------------------
// Hook
// -------------------------------------------------------------

export function useAIConfig(): AIContextValue {
  const ctx = useContext(AIContext);
  if (!ctx) {
    throw new Error('useAIConfig muss innerhalb von <AIProvider> genutzt werden');
  }
  return ctx;
}
