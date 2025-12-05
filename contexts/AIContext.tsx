import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Mutex } from 'async-mutex';

import SecureKeyManager from '../lib/SecureKeyManager';

export type QualityMode = 'speed' | 'quality';
export type AllAIProviders = 'groq' | 'gemini' | 'openai' | 'anthropic' | 'huggingface';
export type ModelTier = 'free' | 'credit' | 'paid';
export type ModelPersona = 'speed' | 'quality' | 'balanced' | 'review';

export type ModelInfo = {
  id: string;
  label: string;
  description: string;
  tier: ModelTier;
  persona: ModelPersona;
  bestFor: string;
  contextWindow?: string;
  isAuto?: boolean;
  docsUrl?: string;
};

export type ProviderDefaults = {
  auto?: string;
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
  docsUrl?: string;
};

export type ProviderLimitStatus = {
  limitReached: boolean;
  lastError?: string;
  lastRotation?: string;
  rotations?: number;
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
  rotateApiKeyOnError: (provider: AllAIProviders, reason?: string) => Promise<boolean>;
  getCurrentApiKey: (provider: AllAIProviders) => string | null;
  providerStatus: Record<AllAIProviders, ProviderLimitStatus>;
  acknowledgeProviderStatus: (provider: AllAIProviders) => void;
};

const PROVIDERS: AllAIProviders[] = ['groq', 'gemini', 'openai', 'anthropic', 'huggingface'];

export const PROVIDER_DEFAULTS: Record<AllAIProviders, ProviderDefaults> = {
  groq: {
    auto: 'auto-groq',
    speed: 'llama-3.1-8b-instant',
    quality: 'llama-3.3-70b-versatile',
  },
  gemini: {
    auto: 'auto-gemini',
    speed: 'gemini-2.0-flash-lite-001',
    quality: 'gemini-2.5-pro',
  },
  openai: {
    auto: 'auto-openai',
    speed: 'gpt-4o-mini',
    quality: 'gpt-4o',
  },
  anthropic: {
    auto: 'auto-claude',
    speed: 'claude-3-5-haiku-20241022',
    quality: 'claude-3-5-sonnet-20241022',
  },
  huggingface: {
    auto: 'auto-hf',
    speed: 'mistralai/Mistral-7B-Instruct-v0.3',
    quality: 'Qwen/Qwen2.5-Coder-32B-Instruct',
  },
};

export const PROVIDER_METADATA: Record<AllAIProviders, ProviderMetadata> = {
  groq: {
    id: 'groq',
    label: 'Groq',
    emoji: '⚙️',
    description:
      'FPGA-beschleunigte Llama/Qwen-Varianten. Perfekt für iteratives Coding mit sehr geringer Latenz.',
    hero: 'Maximale Geschwindigkeit bei solider Code-Qualität.',
    accent: '#ff8c37',
    freeHint: 'Free-Tier mit schnellem Llama 3.1 8B – ideal für Speed-Mode.',
    docsUrl: 'https://console.groq.com/docs',
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    emoji: '🤖',
    description:
      'Große Kontextfenster bis 2 Mio. Tokens. Sehr gut für Architektur-Entscheidungen und Multimodalität.',
    hero: 'Balance aus Geschwindigkeit und Kontexttiefe.',
    accent: '#5e8bff',
    freeHint: 'Flash-Lite deckt das Free-Kontingent ab, Pro erfordert Billing.',
    docsUrl: 'https://ai.google.dev',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    emoji: '🧠',
    description:
      'GPT-4o Familie für hochwertige Code-Generierung, inklusive reasoning-fähiger Spezialmodelle.',
    hero: 'Höchste Code-Qualität & Tool-Unterstützung.',
    accent: '#7c4dff',
    docsUrl: 'https://platform.openai.com/docs',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    emoji: '🧩',
    description:
      'Claude 3.5 liefert extrem saubere, kommentierte Ergebnisse. Ideal als Quality-/Review-Agent.',
    hero: 'Strenge Validierung und konsistente Antworten.',
    accent: '#ff5c8d',
    docsUrl: 'https://docs.anthropic.com',
  },
  huggingface: {
    id: 'huggingface',
    label: 'HuggingFace',
    emoji: '📦',
    description:
      'Open-Source-Instruct-Modelle für Experimente ohne Kosten. Benötigt eigenes Inferenz-Kontingent.',
    hero: 'Kostenlose OSS-Modelle für Experimente.',
    accent: '#f5a524',
    freeHint: 'API-Keys lassen sich mit Spaces oder Inference Endpoints generieren.',
    docsUrl: 'https://huggingface.co/docs/api-inference/detailed_parameters',
  },
};

export const AVAILABLE_MODELS: Record<AllAIProviders, ModelInfo[]> = {
  groq: [
    {
      id: 'auto-groq',
      label: '🎯 Auto (empfohlen)',
      description:
        'Wählt automatisch zwischen Speed (8B) und Quality (70B) basierend auf deinem Qualitätsmodus.',
      tier: 'credit',
      persona: 'balanced',
      bestFor: 'Standardbetrieb ohne manuelles Umschalten.',
      contextWindow: '8K-32K Tokens',
      isAuto: true,
    },
    {
      id: 'llama-3.3-70b-versatile',
      label: 'Llama 3.3 70B Versatile',
      description:
        'Großes Meta-Modell mit sehr guter Planung und TypeScript-Verständnis.',
      tier: 'paid',
      persona: 'quality',
      bestFor: 'Komplexe Refactorings & Architekturen.',
      contextWindow: '8K Tokens',
    },
    {
      id: 'llama-3.1-8b-instant',
      label: 'Llama 3.1 8B Instant',
      description: 'Extrem schnelle Antworten, perfekt für Experimente und Sketches.',
      tier: 'free',
      persona: 'speed',
      bestFor: 'Speed-Mode, kleine Snippets & Tests.',
      contextWindow: '8K Tokens',
    },
    {
      id: 'mixtral-8x7b-32768',
      label: 'Mixtral 8x7B (32k)',
      description: 'Mixture-of-Experts mit langem Kontext. Gute Balance aus Preis/Leistung.',
      tier: 'credit',
      persona: 'balanced',
      bestFor: 'Längere Dateien >10k Tokens und Editor-Prompts.',
      contextWindow: '32K Tokens',
    },
    {
      id: 'qwen/qwen3-32b',
      label: 'Qwen3 32B',
      description:
        'Open-Source LLM mit starkem Python/TypeScript Fokus und cleveren Tool-Tipps.',
      tier: 'credit',
      persona: 'quality',
      bestFor: 'Mehrsprachige Projekte & Fullstack-Aufgaben.',
      contextWindow: '32K Tokens',
    },
    {
      id: 'groq/compound',
      label: 'Groq Compound',
      description:
        'Meta-Modell, das mehrere LLMs orchestriert. Ideal für Reviews & Validierung.',
      tier: 'paid',
      persona: 'review',
      bestFor: 'Code-Reviews, Sicherheitschecks und Tests.',
      contextWindow: '16K Tokens',
    },
  ],
  gemini: [
    {
      id: 'auto-gemini',
      label: '🎯 Auto Gemini',
      description: 'Wechselt dynamisch zwischen Flash-Lite (speed) und Pro (quality).',
      tier: 'credit',
      persona: 'balanced',
      bestFor: 'Wenn du zwischen Qualität und Kosten balancieren willst.',
      contextWindow: '1M Tokens',
      isAuto: true,
    },
    {
      id: 'gemini-2.0-flash-lite-001',
      label: 'Gemini 2.0 Flash-Lite',
      description: 'Sehr schnell und kostengünstig, deckt das Free-Kontingent ab.',
      tier: 'free',
      persona: 'speed',
      bestFor: 'Speed-Mode, UI-Ideen, kleine Komponenten.',
      contextWindow: '128K Tokens',
    },
    {
      id: 'gemini-flash-latest',
      label: 'Gemini Flash (Latest)',
      description: 'Neueste Flash-Version mit guter Balance.',
      tier: 'credit',
      persona: 'balanced',
      bestFor: 'Lange Chats mit solidem Preis/Leistungsverhältnis.',
      contextWindow: '1M Tokens',
    },
    {
      id: 'gemini-1.5-flash-latest',
      label: 'Gemini 1.5 Flash',
      description: 'Stabile Flash-Variante mit 1.5-Release-Features.',
      tier: 'credit',
      persona: 'balanced',
      bestFor: 'Große Rewrites & mehrstufige Prompts.',
      contextWindow: '1M Tokens',
    },
    {
      id: 'gemini-1.5-pro-latest',
      label: 'Gemini 1.5 Pro',
      description: 'Sehr hohe Qualität, riesiger Kontext – benötigt Billing.',
      tier: 'paid',
      persona: 'quality',
      bestFor: 'Architektur-Designs, komplexe Migrationsaufgaben.',
      contextWindow: '2M Tokens',
    },
    {
      id: 'gemini-2.5-pro',
      label: 'Gemini 2.5 Pro',
      description: 'Neueste Pro-Generation mit verbessertem Reasoning.',
      tier: 'paid',
      persona: 'review',
      bestFor: 'QA, Validierung & tiefe Analysen.',
      contextWindow: '1M Tokens',
    },
  ],
  openai: [
    {
      id: 'auto-openai',
      label: '🎯 Auto OpenAI',
      description: 'Wählt automatisch GPT-4o oder GPT-4o-mini je nach Qualitätsmodus.',
      tier: 'paid',
      persona: 'balanced',
      bestFor: 'Wenn du OpenAI nutzt und nur den Modus wechseln willst.',
      contextWindow: '128K Tokens',
      isAuto: true,
    },
    {
      id: 'gpt-4o',
      label: 'GPT-4o',
      description: 'Flaggschiff-Modell, sehr stark bei UI + State-Management.',
      tier: 'paid',
      persona: 'quality',
      bestFor: 'Produktionsreife Features & komplexe Integrationen.',
      contextWindow: '128K Tokens',
    },
    {
      id: 'gpt-4o-mini',
      label: 'GPT-4o mini',
      description: 'Günstiger & schneller, ideal für Speed-Iterationen.',
      tier: 'credit',
      persona: 'speed',
      bestFor: 'Skizzen, kleinere Bugfixes, schnelle Helfer.',
      contextWindow: '128K Tokens',
    },
    {
      id: 'gpt-4.1-mini',
      label: 'GPT-4.1 mini',
      description: 'Neuer reasoning-fokussierter Mini-Stack.',
      tier: 'paid',
      persona: 'balanced',
      bestFor: 'Tool-Aufrufe & Tests mit JSON-Ausgaben.',
      contextWindow: '200K Tokens',
    },
    {
      id: 'gpt-4.1',
      label: 'GPT-4.1',
      description: 'Nachfolger von GPT-4 Turbo mit verbessertem Kontext.',
      tier: 'paid',
      persona: 'quality',
      bestFor: 'Enterprise-Flows, hochkritische Änderungen.',
      contextWindow: '200K Tokens',
    },
    {
      id: 'o1-mini',
      label: 'OpenAI o1-mini',
      description: 'Reasoning-optimiertes Modell für Validierung.',
      tier: 'paid',
      persona: 'review',
      bestFor: 'Prüfung & JSON-Validierung in Quality-Agent-Flow.',
      contextWindow: '200K Tokens',
    },
  ],
  anthropic: [
    {
      id: 'auto-claude',
      label: '🎯 Auto Claude',
      description: 'Wählt automatisch Sonnet (quality) oder Haiku (speed).',
      tier: 'paid',
      persona: 'balanced',
      bestFor: 'Wenn Claude deine Standard-KI ist.',
      contextWindow: '200K Tokens',
      isAuto: true,
    },
    {
      id: 'claude-3-5-sonnet-20241022',
      label: 'Claude 3.5 Sonnet (10/2024)',
      description: 'Sehr hohe Code-Qualität, ausführliche Erklärungen.',
      tier: 'paid',
      persona: 'quality',
      bestFor: 'Quality-Agent, Reviews, Validierung.',
      contextWindow: '200K Tokens',
    },
    {
      id: 'claude-3-5-haiku-20241022',
      label: 'Claude 3.5 Haiku (10/2024)',
      description: 'Günstigere & schnellere Variante für den Builder.',
      tier: 'credit',
      persona: 'speed',
      bestFor: 'Schnelle Antworten mit Claude-Stil.',
      contextWindow: '200K Tokens',
    },
    {
      id: 'claude-3-opus-20240229',
      label: 'Claude 3 Opus',
      description: 'Maximale Gründlichkeit, aber teuer.',
      tier: 'paid',
      persona: 'review',
      bestFor: 'Audit, Security & Red-Team Reviews.',
      contextWindow: '200K Tokens',
    },
    {
      id: 'claude-3-sonnet-20240229',
      label: 'Claude 3 Sonnet (02/2024)',
      description: 'Ältere, stabile Variante mit verlässlichem Output.',
      tier: 'paid',
      persona: 'balanced',
      bestFor: 'Legacy-Validierung & Regressionstests.',
      contextWindow: '200K Tokens',
    },
    {
      id: 'claude-3-haiku-20240307',
      label: 'Claude 3 Haiku',
      description: 'Sehr schnell und günstig, ideal für Drafts.',
      tier: 'credit',
      persona: 'speed',
      bestFor: 'Vorbereitungsschritte & erste Ideen.',
      contextWindow: '200K Tokens',
    },
  ],
  huggingface: [
    {
      id: 'auto-hf',
      label: '🎯 Auto HuggingFace',
      description: 'Wählt automatisch geeignete OSS-Modelle je nach Modus.',
      tier: 'free',
      persona: 'balanced',
      bestFor: 'Experimente ohne feste Präferenz.',
      contextWindow: '4K-32K Tokens',
      isAuto: true,
    },
    {
      id: 'mistralai/Mistral-7B-Instruct-v0.3',
      label: 'Mistral 7B Instruct v0.3',
      description: 'Klassisches OSS-Modell für schnelle Tests.',
      tier: 'free',
      persona: 'speed',
      bestFor: 'Proof-of-Concepts, kleine Helper.',
      contextWindow: '8K Tokens',
    },
    {
      id: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      label: 'Qwen2.5 Coder 32B',
      description: 'Code-spezialisiert, sehr gute Typsicherheit.',
      tier: 'free',
      persona: 'quality',
      bestFor: 'TypeScript/React-Arbeiten mit OSS.',
      contextWindow: '32K Tokens',
    },
    {
      id: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
      label: 'Meta Llama 3.1 70B',
      description: 'High-End OSS Modell mit hoher Präzision.',
      tier: 'free',
      persona: 'quality',
      bestFor: 'Große Features ohne proprietäre Modelle.',
      contextWindow: '8K Tokens',
    },
    {
      id: 'bigcode/starcoder2-15b',
      label: 'StarCoder2 15B',
      description: 'Spezialisiert auf Code Completion & IDE-Flows.',
      tier: 'free',
      persona: 'speed',
      bestFor: 'Auto-Completion & Snippets.',
      contextWindow: '8K Tokens',
    },
    {
      id: 'WizardLM/WizardCoder-15B-V1.0',
      label: 'WizardCoder 15B',
      description: 'Fokus auf komplexe Coding-Aufgaben mit OSS.',
      tier: 'free',
      persona: 'review',
      bestFor: 'Offline-Validierung & Experimente.',
      contextWindow: '8K Tokens',
    },
  ],
};

const CONFIG_STORAGE_KEY = 'ai_config_v3';

const DEFAULT_CONFIG: AIConfig = {
  version: 3,
  selectedChatProvider: 'groq',
  selectedChatMode: PROVIDER_DEFAULTS.groq.auto ?? PROVIDER_DEFAULTS.groq.speed,
  selectedAgentProvider: 'anthropic',
  selectedAgentMode: PROVIDER_DEFAULTS.anthropic.quality,
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

interface StoredConfig {
  version?: number;
  selectedChatProvider?: string;
  selectedChatMode?: string;
  selectedAgentProvider?: string;
  selectedAgentMode?: string;
  qualityMode?: string;
  apiKeys?: Partial<Record<AllAIProviders, string[]>>;
}

const isValidProvider = (value: unknown): value is AllAIProviders =>
  typeof value === 'string' && (PROVIDERS as string[]).includes(value);

const ensureModeForProvider = (
  provider: AllAIProviders,
  candidate: string | undefined,
  fallbackPreference: 'auto' | 'quality' | 'speed',
): string => {
  const list = AVAILABLE_MODELS[provider] ?? [];
  const ids = list.map((mode) => mode.id);
  if (candidate && ids.includes(candidate)) {
    return candidate;
  }

  const defaults = PROVIDER_DEFAULTS[provider];

  if (fallbackPreference === 'auto' && defaults.auto && ids.includes(defaults.auto)) {
    return defaults.auto;
  }
  if (fallbackPreference === 'quality' && ids.includes(defaults.quality)) {
    return defaults.quality;
  }
  if (fallbackPreference === 'speed' && ids.includes(defaults.speed)) {
    return defaults.speed;
  }

  return ids[0] ?? '';
};

const migrateConfig = (raw: unknown): AIConfig => {
  if (!raw) return { ...DEFAULT_CONFIG };

  let parsed: StoredConfig;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw) as StoredConfig;
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  } else if (typeof raw === 'object' && raw !== null) {
    parsed = raw as StoredConfig;
  } else {
    return { ...DEFAULT_CONFIG };
  }

  const storedVersion = typeof parsed.version === 'number' ? parsed.version : 1;

  const selectedChatProvider = isValidProvider(parsed.selectedChatProvider)
    ? parsed.selectedChatProvider
    : DEFAULT_CONFIG.selectedChatProvider;

  const selectedAgentProvider = isValidProvider(parsed.selectedAgentProvider)
    ? parsed.selectedAgentProvider
    : DEFAULT_CONFIG.selectedAgentProvider;

  const qualityMode: QualityMode = parsed.qualityMode === 'quality' ? 'quality' : 'speed';

  const apiKeys = PROVIDERS.reduce(
    (acc, provider) => ({
      ...acc,
      [provider]: Array.isArray(parsed.apiKeys?.[provider])
        ? parsed.apiKeys?.[provider] ?? []
        : [],
    }),
    {} as Record<AllAIProviders, string[]>,
  );

  return {
    version: Math.max(storedVersion, DEFAULT_CONFIG.version),
    selectedChatProvider,
    selectedChatMode: ensureModeForProvider(
      selectedChatProvider,
      parsed.selectedChatMode,
      'auto',
    ),
    selectedAgentProvider,
    selectedAgentMode: ensureModeForProvider(
      selectedAgentProvider,
      parsed.selectedAgentMode,
      'quality',
    ),
    qualityMode,
    apiKeys,
  };
};

const updateSecureKeyManager = (cfg: AIConfig) => {
  PROVIDERS.forEach((provider) => {
    const keys = cfg.apiKeys[provider];
    if (keys && keys.length > 0) {
      SecureKeyManager.setKeys(provider, keys);
    } else {
      SecureKeyManager.clearKeys(provider);
    }
  });

  console.log('[AIContext] 🔐 SecureKeyManager aktualisiert');
};

// ✅ FIX: Ref-based State statt module-level für bessere Testbarkeit
const configRef: { current: AIConfig | null } = { current: null };
const rotateFunctionRef: { 
  current: ((provider: AllAIProviders, reason?: string) => Promise<boolean>) | null 
} = { current: null };

export const getAIConfig = (): AIConfig | null => {
  if (configRef.current === null) {
    console.warn('[AIContext] getAIConfig() called before initialization. Use useAI() hook instead.');
  }
  return configRef.current;
};

const setAIConfig = (cfg: AIConfig) => {
  configRef.current = cfg;
};

export const setRotateFunction = (
  fn: (provider: AllAIProviders, reason?: string) => Promise<boolean>,
) => {
  rotateFunctionRef.current = fn;
};

export const rotateApiKeyOnError = async (
  provider: AllAIProviders,
  reason?: string,
): Promise<boolean> => {
  if (!rotateFunctionRef.current) {
    console.error('❌ [AIContext] Rotate-Funktion nicht initialisiert');
    return false;
  }
  return rotateFunctionRef.current(provider, reason);
};

const createInitialProviderStatus = (): Record<AllAIProviders, ProviderLimitStatus> =>
  PROVIDERS.reduce(
    (acc, provider) => ({
      ...acc,
      [provider]: { limitReached: false, rotations: 0 },
    }),
    {} as Record<AllAIProviders, ProviderLimitStatus>,
  );

export const AIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [providerStatus, setProviderStatus] = useState<Record<AllAIProviders, ProviderLimitStatus>>(
    createInitialProviderStatus,
  );
  
  // ✅ FIX: Mutex für API Key Rotation gegen Race Conditions
  const rotationMutexRef = useRef(new Mutex());

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(CONFIG_STORAGE_KEY);
        const migrated = migrateConfig(stored);
        if (!active) return;
        setConfig(migrated);
        setAIConfig(migrated);
        updateSecureKeyManager(migrated);
        console.log('✅ AI-Config geladen');
      } catch (error) {
        console.log('[AIContext] Fehler beim Laden der AI-Config', error);
        setAIConfig(DEFAULT_CONFIG);
        updateSecureKeyManager(DEFAULT_CONFIG);
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
    setAIConfig(next);
    updateSecureKeyManager(next);
    try {
      await AsyncStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.log('[AIContext] Fehler beim Speichern der AI-Config', error);
    }
  }, []);

  const acknowledgeProviderStatus = useCallback((provider: AllAIProviders) => {
    setProviderStatus((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        limitReached: false,
        lastError: undefined,
      },
    }));
  }, []);

  const flagProviderLimit = useCallback((provider: AllAIProviders, reason?: string) => {
    setProviderStatus((prev) => ({
      ...prev,
      [provider]: {
        limitReached: true,
        lastError: reason || 'Kontingent erschöpft oder Key ungültig.',
        lastRotation: new Date().toISOString(),
        rotations: (prev[provider]?.rotations ?? 0) + 1,
      },
    }));
  }, []);

  const setSelectedChatProvider = useCallback(
    (provider: AllAIProviders) => {
      const next = migrateConfig({
        ...config,
        selectedChatProvider: provider,
        selectedChatMode: ensureModeForProvider(provider, config.selectedChatMode, 'auto'),
      });
      persist(next);
    },
    [config, persist],
  );

  const setSelectedChatMode = useCallback(
    (modeId: string) => {
      const next = migrateConfig({
        ...config,
        selectedChatMode: ensureModeForProvider(
          config.selectedChatProvider,
          modeId,
          'auto',
        ),
      });
      persist(next);
    },
    [config, persist],
  );

  const setSelectedAgentProvider = useCallback(
    (provider: AllAIProviders) => {
      const next = migrateConfig({
        ...config,
        selectedAgentProvider: provider,
        selectedAgentMode: ensureModeForProvider(provider, config.selectedAgentMode, 'quality'),
      });
      persist(next);
    },
    [config, persist],
  );

  const setSelectedAgentMode = useCallback(
    (modeId: string) => {
      const next = migrateConfig({
        ...config,
        selectedAgentMode: ensureModeForProvider(
          config.selectedAgentProvider,
          modeId,
          'quality',
        ),
      });
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
      if (!trimmed) throw new Error('API-Key darf nicht leer sein.');

      const existing = config.apiKeys[provider] || [];
      if (existing.includes(trimmed)) {
        throw new Error('Dieser Key existiert bereits.');
      }

      const next = migrateConfig({
        ...config,
        apiKeys: {
          ...config.apiKeys,
          [provider]: [trimmed, ...existing],
        },
      });
      await persist(next);
      acknowledgeProviderStatus(provider);
    },
    [config, persist, acknowledgeProviderStatus],
  );

  const removeApiKey = useCallback(
    async (provider: AllAIProviders, key: string) => {
      const existing = config.apiKeys[provider] || [];
      const filtered = existing.filter((item) => item !== key);

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

  const rotateApiKey = useCallback(
    async (provider: AllAIProviders) => {
      const keys = config.apiKeys[provider] || [];
      if (keys.length <= 1) {
        throw new Error('Mindestens zwei Keys erforderlich, um rotieren zu können.');
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

  const moveApiKeyToFront = useCallback(
    async (provider: AllAIProviders, keyIndex: number) => {
      const keys = config.apiKeys[provider] || [];
      if (keyIndex < 0 || keyIndex >= keys.length) {
        throw new Error('Ungültiger Key-Index');
      }
      const key = keys[keyIndex];
      const filtered = keys.filter((_, idx) => idx !== keyIndex);
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

  const rotateApiKeyOnErrorInternal = useCallback(
    async (provider: AllAIProviders, reason?: string): Promise<boolean> => {
      // ✅ FIX: Mutex protection gegen gleichzeitige Rotationen
      const release = await rotationMutexRef.current.acquire();
      
      try {
        const keys = config.apiKeys[provider] || [];
        if (keys.length <= 1) {
          console.warn(`⚠️ [AIContext] Keine weiteren Keys für ${provider} verfügbar`);
          flagProviderLimit(provider, reason);
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
        flagProviderLimit(provider, reason);
        console.log(`🔄 [AIContext] Auto-Rotation für ${provider}`);

        return true;
      } finally {
        release();
      }
    },
    [config, persist, flagProviderLimit],
  );

  const getCurrentApiKey = useCallback(
    (provider: AllAIProviders): string | null => {
      const keys = config.apiKeys[provider];
      return keys && keys.length > 0 ? keys[0] : null;
    },
    [config],
  );

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
      providerStatus,
      acknowledgeProviderStatus,
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
      providerStatus,
      acknowledgeProviderStatus,
    ],
  );

  // ✅ FIX: Side Effects in useEffect statt während Render
  useEffect(() => {
    if (loaded) {
      setAIConfig(config);
      updateSecureKeyManager(config);
    }
  }, [loaded, config]);

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
};

export const useAI = (): AIContextProps => {
  const ctx = useContext(AIContext);
  if (!ctx) {
    throw new Error('useAI muss innerhalb von <AIProvider> verwendet werden.');
  }
  return ctx;
};
