// contexts/AIContext.tsx - MIT AUTO-ROTATION & MODELL-LISTEN
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type QualityMode = 'speed' | 'quality';
export type AllAIProviders = 'groq' | 'gemini' | 'openai' | 'anthropic' | 'huggingface';

// 🔢 Modell-Metadaten für Settings-UI
export type ModelInfo = {
  id: string;
  label: string;
  description?: string;
};

// ✅ Verfügbare Modelle pro Provider – IDs passen zu deinen echten APIs
export const AVAILABLE_MODELS: Record<AllAIProviders, ModelInfo[]> = {
  groq: [
    {
      id: 'auto-groq',
      label: '🎯 Auto (empfohlen)',
      description:
        'Wählt automatisch ein passendes Groq-Modell (Llama / Qwen / GPT-OSS) je nach Quality-Mode.',
    },
    {
      id: 'llama-3.3-70b-versatile',
      label: 'Llama 3.3 70B Versatile',
      description: 'Großes Modell, sehr gute Code-Qualität. Ideal für Quality-Mode.',
    },
    {
      id: 'llama-3.1-8b-instant',
      label: 'Llama 3.1 8B Instant',
      description: 'Schnell & günstig, ideal für Speed-Mode / Experimente.',
    },
    {
      id: 'qwen/qwen3-32b',
      label: 'Qwen3 32B',
      description: 'Starkes Alternative-Modell, gut für komplexe Aufgaben.',
    },
    {
      id: 'openai/gpt-oss-20b',
      label: 'GPT-OSS 20B',
      description: 'Open-Source GPT-Style Modell (20B).',
    },
    {
      id: 'openai/gpt-oss-120b',
      label: 'GPT-OSS 120B',
      description: 'Sehr großes Modell, eher teuer – für schwere Aufgaben.',
    },
    {
      id: 'openai/gpt-oss-safeguard-20b',
      label: 'GPT-OSS Safeguard 20B',
      description: 'Safe-Guard Variante, stärker moderiert.',
    },
    {
      id: 'allam-2-7b',
      label: 'Allam 2 7B',
      description: 'Kompaktes Modell, experimentell.',
    },
    {
      id: 'moonshotai/kimi-k2-instruct',
      label: 'Kimi K2 Instruct',
      description: 'Starkes Instruct-Modell (Kimi K2).',
    },
    {
      id: 'moonshotai/kimi-k2-instruct-0905',
      label: 'Kimi K2 Instruct 0905',
      description: 'Aktualisierte Version von Kimi K2.',
    },
    {
      id: 'meta-llama/llama-4-maverick-17b-128e-instruct',
      label: 'Llama 4 Maverick 17B Instruct',
      description: 'Neues Llama 4 Instruct-Modell, 17B.',
    },
    {
      id: 'meta-llama/llama-4-scout-17b-16e-instruct',
      label: 'Llama 4 Scout 17B Instruct',
      description: 'Scout-Variante von Llama 4, 17B.',
    },
    {
      id: 'groq/compound',
      label: 'Groq Compound',
      description: 'Meta-Modell, kombiniert mehrere Modelle (experimentell).',
    },
    {
      id: 'groq/compound-mini',
      label: 'Groq Compound Mini',
      description: 'Kleinere, schnellere Compound-Variante.',
    },
  ],
  gemini: [
    {
      id: 'auto-gemini',
      label: '🎯 Auto (empfohlen)',
      description:
        'Wählt automatisch Flash-Lite (speed) oder Pro (quality) basierend auf deinem Quality-Mode.',
    },
    {
      // ✅ Schnell & günstig – Free-/Low-Cost-Bereich
      id: 'gemini-2.0-flash-lite-001',
      label: 'Gemini 2.0 Flash-Lite 001 (Free/günstig)',
      description:
        'Sehr schnelle, günstige Variante. Ideal als Speed-Modell für Code-Generierung.',
    },
    {
      // ✅ Aktuelles Flash – guter Mix
      id: 'gemini-flash-latest',
      label: 'Gemini Flash (Latest)',
      description:
        'Aktuelle Flash-Version mit guter Balance aus Geschwindigkeit und Qualität.',
    },
    {
      // 💰 Stable Pro – kostenpflichtig, hohe Qualität
      id: 'gemini-2.5-pro',
      label: 'Gemini 2.5 Pro (Paid)',
      description:
        'Stable Pro-Release mit sehr hoher Code- und Analysequalität. Eher kostenpflichtig.',
    },
    {
      // 💰 Pro-Latest – aliasartig, ebenfalls Paid
      id: 'gemini-pro-latest',
      label: 'Gemini Pro (Latest, Paid)',
      description:
        '„Latest“ Alias der Pro-Reihe. Für anspruchsvolle Projekte gedacht.',
    },
  ],
  openai: [
    {
      id: 'auto-openai',
      label: '🎯 Auto OpenAI',
      description: 'Wählt automatisch ein OpenAI-Modell (z. B. GPT-4o / GPT-4o-mini).',
    },
    {
      id: 'gpt-4o',
      label: 'GPT-4o',
      description: 'Starkes Allround-Modell für Code & Gespräch.',
    },
    {
      id: 'gpt-4o-mini',
      label: 'GPT-4o Mini',
      description: 'Schneller & günstiger als GPT-4o, ideal für Speed.',
    },
  ],
  anthropic: [
    {
      id: 'auto-claude',
      label: '🎯 Auto Claude',
      description: 'Wählt automatisch eine passende Claude-Variante.',
    },
    {
      id: 'claude-3-5-sonnet-20241022',
      label: 'Claude 3.5 Sonnet (2024-10-22)',
      description: 'High-End-Modell, sehr gut für Quality-Validierung.',
    },
    {
      id: 'claude-3-5-haiku-20241022',
      label: 'Claude 3.5 Haiku (2024-10-22)',
      description: 'Schnellere, günstigere Variante von Claude.',
    },
  ],
  huggingface: [
    {
      id: 'auto-hf',
      label: '🎯 Auto HuggingFace',
      description: 'Wählt automatisch ein passendes HF-Instruct-Modell.',
    },
    {
      id: 'mistralai/Mistral-7B-Instruct-v0.3',
      label: 'Mistral 7B Instruct v0.3',
      description:
        'Klassisches Open-Source Instruct-Modell, gut zum Experimentieren.',
    },
  ],
};

export type AIConfig = {
  version: number;
  selectedChatProvider: AllAIProviders;
  selectedChatMode: string;
  selectedAgentProvider: AllAIProviders;
  selectedAgentMode: string;
  qualityMode: QualityMode;
  apiKeys: Record<AllAIProviders, string[]>;
};

export type AIContextProps = {
  config: AIConfig;
  setSelectedChatProvider: (provider: AllAIProviders) => void;
  setSelectedChatMode: (modeId: string) => void;
  setSelectedAgentProvider: (provider: AllAIProviders) => void;
  setSelectedAgentMode: (modeId: string) => void;
  setQualityMode: (mode: QualityMode) => void;
  addApiKey: (provider: AllAIProviders, key: string) => Promise<void>;
  removeApiKey: (provider: AllAIProviders, key: string) => Promise<void>;
  rotateApiKey: (provider: AllAIProviders) => Promise<void>;
  moveApiKeyToFront: (provider: AllAIProviders, keyIndex: number) => Promise<void>;
  rotateApiKeyOnError: (provider: AllAIProviders) => Promise<boolean>;
  getCurrentApiKey: (provider: AllAIProviders) => string | null;
};

const CONFIG_STORAGE_KEY = 'ai_config_v2';

const DEFAULT_CONFIG: AIConfig = {
  version: 2,
  selectedChatProvider: 'groq',
  selectedChatMode: 'auto-groq',
  selectedAgentProvider: 'groq',
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

const AIContext = createContext<AIContextProps | undefined>(undefined);

const migrateConfig = (raw: any): AIConfig => {
  if (!raw) return { ...DEFAULT_CONFIG };

  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  const version = typeof parsed.version === 'number' ? parsed.version : 1;

  const selectedChatProvider: AllAIProviders =
    ['groq', 'gemini', 'openai', 'anthropic', 'huggingface'].includes(
      parsed.selectedChatProvider,
    )
      ? parsed.selectedChatProvider
      : DEFAULT_CONFIG.selectedChatProvider;

  const selectedAgentProvider: AllAIProviders =
    ['groq', 'gemini', 'openai', 'anthropic', 'huggingface'].includes(
      parsed.selectedAgentProvider,
    )
      ? parsed.selectedAgentProvider
      : DEFAULT_CONFIG.selectedAgentProvider;

  const selectedChatMode = parsed.selectedChatMode || DEFAULT_CONFIG.selectedChatMode;
  const selectedAgentMode =
    parsed.selectedAgentMode || DEFAULT_CONFIG.selectedAgentMode;

  const qualityMode: QualityMode =
    parsed.qualityMode === 'quality' ? 'quality' : 'speed';

  const apiKeys = {
    groq: Array.isArray(parsed.apiKeys?.groq) ? parsed.apiKeys.groq : [],
    gemini: Array.isArray(parsed.apiKeys?.gemini) ? parsed.apiKeys.gemini : [],
    openai: Array.isArray(parsed.apiKeys?.openai) ? parsed.apiKeys.openai : [],
    anthropic: Array.isArray(parsed.apiKeys?.anthropic)
      ? parsed.apiKeys.anthropic
      : [],
    huggingface: Array.isArray(parsed.apiKeys?.huggingface)
      ? parsed.apiKeys.huggingface
      : [],
  };

  return {
    version: Math.max(version, DEFAULT_CONFIG.version),
    selectedChatProvider,
    selectedChatMode,
    selectedAgentProvider,
    selectedAgentMode,
    qualityMode,
    apiKeys,
  };
};

const updateRuntimeGlobals = (cfg: AIConfig) => {
  (global as any).__K1W1_AI_CONFIG = cfg;

  // API-Keys in Runtime spiegeln
  const providers: AllAIProviders[] = [
    'groq',
    'gemini',
    'openai',
    'anthropic',
    'huggingface',
  ];
  providers.forEach((provider) => {
    const keys = cfg.apiKeys[provider];
    if (keys && keys.length > 0) {
      const currentKey = keys[0];
      switch (provider) {
        case 'groq':
          (global as any).GROQ_API_KEY = currentKey;
          break;
        case 'gemini':
          (global as any).GEMINI_API_KEY = currentKey;
          break;
        case 'openai':
          (global as any).OPENAI_API_KEY = currentKey;
          break;
        case 'anthropic':
          (global as any).ANTHROPIC_API_KEY = currentKey;
          break;
        case 'huggingface':
          (global as any).HUGGINGFACE_API_KEY = currentKey;
          break;
      }
    }
  });

  console.log('[AIContext] 🔄 Runtime-Globals aktualisiert');
};

// ✅ Globale Export-Funktionen für Orchestrator
export const getAIConfig = (): AIConfig | null => {
  return (global as any).__K1W1_AI_CONFIG || null;
};

let _rotateFunction: ((provider: AllAIProviders) => Promise<boolean>) | null = null;

export const setRotateFunction = (
  fn: (provider: AllAIProviders) => Promise<boolean>,
) => {
  _rotateFunction = fn;
};

export const rotateApiKeyOnError = async (
  provider: AllAIProviders,
): Promise<boolean> => {
  if (!_rotateFunction) {
    console.error('❌ [AIContext] Rotate-Funktion nicht initialisiert');
    return false;
  }
  return _rotateFunction(provider);
};

export const AIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(CONFIG_STORAGE_KEY);
        const migrated = migrateConfig(stored);
        if (!active) return;
        setConfig(migrated);
        updateRuntimeGlobals(migrated);
        console.log('✅ AI-Config geladen');
      } catch (e) {
        console.log('[AIContext] Fehler beim Laden der AI-Config', e);
        updateRuntimeGlobals(DEFAULT_CONFIG);
      } finally {
        if (active) setLoaded(true);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback(async (next: AIConfig) => {
    setConfig(next);
    updateRuntimeGlobals(next);
    try {
      await AsyncStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.log('[AIContext] Fehler beim Speichern der AI-Config', e);
    }
  }, []);

  const setSelectedChatProvider = useCallback(
    (provider: AllAIProviders) => {
      const next = migrateConfig({ ...config, selectedChatProvider: provider });
      persist(next);
    },
    [config, persist],
  );

  const setSelectedChatMode = useCallback(
    (modeId: string) => {
      const next = migrateConfig({ ...config, selectedChatMode: modeId });
      persist(next);
    },
    [config, persist],
  );

  const setSelectedAgentProvider = useCallback(
    (provider: AllAIProviders) => {
      const next = migrateConfig({ ...config, selectedAgentProvider: provider });
      persist(next);
    },
    [config, persist],
  );

  const setSelectedAgentMode = useCallback(
    (modeId: string) => {
      const next = migrateConfig({ ...config, selectedAgentMode: modeId });
      persist(next);
    },
    [config, persist],
  );

  const setQualityMode = useCallback(
    (mode: QualityMode) => {
      const next = migrateConfig({ ...config, qualityMode: mode });
      persist(next);
    },
    [config, persist],
  );

  const addApiKey = useCallback(
    async (provider: AllAIProviders, key: string) => {
      const trimmed = key.trim();
      if (!trimmed) throw new Error('API-Key darf nicht leer sein');

      const existing = config.apiKeys[provider] || [];
      if (existing.includes(trimmed)) {
        throw new Error('Dieser Key existiert bereits');
      }

      const next = migrateConfig({
        ...config,
        apiKeys: {
          ...config.apiKeys,
          [provider]: [trimmed, ...existing],
        },
      });
      await persist(next);
    },
    [config, persist],
  );

  const removeApiKey = useCallback(
    async (provider: AllAIProviders, key: string) => {
      const existing = config.apiKeys[provider] || [];
      const filtered = existing.filter((k) => k !== key);

      const next = migrateConfig({
        ...config,
        apiKeys: {
          ...config.apiKeys,
          [provider]: filtered,
        },
      });
      await persist(next);
    },
    [config, persist],
  );

  // ✅ Manuelle Rotation (für Settings UI)
  const rotateApiKey = useCallback(
    async (provider: AllAIProviders) => {
      const keys = config.apiKeys[provider] || [];
      if (keys.length <= 1) {
        throw new Error('Mindestens 2 Keys erforderlich für Rotation');
      }

      const rotated = [...keys.slice(1), keys[0]];

      const next = migrateConfig({
        ...config,
        apiKeys: {
          ...config.apiKeys,
          [provider]: rotated,
        },
      });
      await persist(next);
      console.log(`🔄 [AIContext] Manuelle Rotation für ${provider}`);
    },
    [config, persist],
  );

  // ✅ Key an Position X nach vorne schieben
  const moveApiKeyToFront = useCallback(
    async (provider: AllAIProviders, keyIndex: number) => {
      const keys = config.apiKeys[provider] || [];
      if (keyIndex < 0 || keyIndex >= keys.length) {
        throw new Error('Ungültiger Key-Index');
      }
      const key = keys[keyIndex];
      const filtered = keys.filter((_, i) => i !== keyIndex);
      const reordered = [key, ...filtered];

      const next = migrateConfig({
        ...config,
        apiKeys: {
          ...config.apiKeys,
          [provider]: reordered,
        },
      });
      await persist(next);
    },
    [config, persist],
  );

  // ✅ Auto-Rotation bei Error (für Orchestrator)
  const rotateApiKeyOnErrorInternal = useCallback(
    async (provider: AllAIProviders): Promise<boolean> => {
      const keys = config.apiKeys[provider] || [];

      if (keys.length <= 1) {
        console.warn(
          `⚠️ [AIContext] Keine weiteren Keys für ${provider} verfügbar`,
        );
        return false;
      }

      const rotated = [...keys.slice(1), keys[0]];

      const next = migrateConfig({
        ...config,
        apiKeys: {
          ...config.apiKeys,
          [provider]: rotated,
        },
      });

      await persist(next);

      console.log(
        `🔄 [AIContext] Auto-Rotation für ${provider}: ${rotated[0].slice(
          0,
          8,
        )}... ist jetzt aktiv`,
      );

      return true;
    },
    [config, persist],
  );

  const getCurrentApiKey = useCallback(
    (provider: AllAIProviders): string | null => {
      const keys = config.apiKeys[provider];
      return keys && keys.length > 0 ? keys[0] : null;
    },
    [config],
  );

  // ✅ Rotate-Funktion für Orchestrator registrieren
  useEffect(() => {
    setRotateFunction(rotateApiKeyOnErrorInternal);
    return () => setRotateFunction(() => Promise.resolve(false));
  }, [rotateApiKeyOnErrorInternal]);

  const value: AIContextProps = useMemo(
    () => ({
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
      rotateApiKeyOnError: rotateApiKeyOnErrorInternal,
      getCurrentApiKey,
    }),
    [
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
      rotateApiKeyOnErrorInternal,
      getCurrentApiKey,
    ],
  );

  if (!loaded) {
    updateRuntimeGlobals(config);
  }

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
};

export const useAI = (): AIContextProps => {
  const ctx = useContext(AIContext);
  if (!ctx) {
    throw new Error('useAI muss innerhalb von <AIProvider> verwendet werden.');
  }
  return ctx;
};
