import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { Mutex } from 'async-mutex';

// ============================================================================
// PROVIDER ROLES & TYPES
// ============================================================================
export const CHAT_PROVIDER = 'groq' as const;
export const AGENT_PROVIDER = 'gemini' as const;
const ALL_POSSIBLE_PROVIDERS = ['groq', 'openai', 'gemini', 'anthropic'] as const;
export type AllAIProviders = typeof ALL_POSSIBLE_PROVIDERS[number];
export type AIProvider = typeof CHAT_PROVIDER | typeof AGENT_PROVIDER;

export type AIMode = string;
export type QualityMode = 'speed' | 'quality';
export type ApiKeyList = Record<AllAIProviders, string[]>;
export type ApiKeyIndexMap = Record<AllAIProviders, number>;

export interface AIConfig {
  selectedChatProvider: typeof CHAT_PROVIDER;
  selectedChatMode: AIMode;
  selectedAgentProvider: typeof AGENT_PROVIDER;
  selectedAgentMode: AIMode;
  qualityMode: QualityMode;
  keys: ApiKeyList;
  keyIndexes: ApiKeyIndexMap;
}

interface AIContextProps {
  config: AIConfig;
  isLoading: boolean;
  setSelectedChatMode: (mode: AIMode) => Promise<void>;
  setSelectedAgentMode: (mode: AIMode) => Promise<void>;
  setQualityMode: (mode: QualityMode) => Promise<void>;
  addApiKey: (provider: AllAIProviders, key: string) => Promise<void>;
  removeApiKey: (provider: AllAIProviders, key: string) => Promise<void>;
  rotateApiKey: (provider: AllAIProviders) => Promise<string | null>;
  getCurrentApiKey: (provider: AllAIProviders) => string | null;
  updateConfig: (newConfig: Partial<AIConfig>) => Promise<void>;
}

// ============================================================================
// CONSTANTS & CONTEXT
// ============================================================================
const AIContext = createContext<AIContextProps | undefined>(undefined);
// 🔥 FIX: Bleibt auf v1, um deine Keys zu laden!
const CONFIG_STORAGE_KEY = 'ai_config_v1';

// 🔥 FIX: ALLE Groq-Modelle wiederhergestellt
export const AVAILABLE_MODELS: Record<AllAIProviders, { id: string; label?: string }[]> = {
  groq: [
    { id: 'auto-groq', label: 'Auto (Empfohlen)' },
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B' },
    { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
    { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B' },
    { id: 'qwen/qwen3-32b', label: 'Qwen 3 32B' },
    { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout' },
  ],
  gemini: [
    { id: 'gemini-1.5-pro-latest', label: 'Gemini 1.5 Pro (Empfohlen)' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { id: 'gemini-1.5-flash-latest', label: 'Gemini 1.5 Flash' },
  ],
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  anthropic: [
    { id: 'claude-opus-4-1-20250805', label: 'Claude Opus 4.1'},
    { id: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
    { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
    { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' }
  ],
};

const getDefaultConfig = (): AIConfig => ({
  selectedChatProvider: 'groq',
  selectedChatMode: 'auto-groq',
  selectedAgentProvider: 'gemini',
  selectedAgentMode: 'gemini-1.5-pro-latest',
  qualityMode: 'speed',
  keys: { groq: [], openai: [], gemini: [], anthropic: [] },
  keyIndexes: { groq: 0, openai: 0, gemini: 0, anthropic: 0 },
});

const saveMutex = new Mutex();

// ============================================================================
// PROVIDER
// ============================================================================
export const AIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AIConfig>(getDefaultConfig());
  const [isLoading, setIsLoading] = useState(true);

  // Lade Konfiguration beim Start
  useEffect(() => {
    const loadConfig = async () => {
      setIsLoading(true);
      try {
        const storedConfig = await AsyncStorage.getItem(CONFIG_STORAGE_KEY);
        if (storedConfig) {
          const parsed = JSON.parse(storedConfig);
          const defaultConfig = getDefaultConfig();

          // Merge alte Daten (v1) mit neuer Struktur (v2), behalte Keys
          const mergedConfig: AIConfig = {
            selectedChatProvider: 'groq',
            selectedAgentProvider: 'gemini',
            selectedChatMode: AVAILABLE_MODELS.groq.some(m => m.id === (parsed.selectedChatMode || parsed.selectedMode))
              ? (parsed.selectedChatMode || parsed.selectedMode)
              : defaultConfig.selectedChatMode,
            selectedAgentMode: AVAILABLE_MODELS.gemini.some(m => m.id === parsed.selectedAgentMode)
              ? parsed.selectedAgentMode
              : defaultConfig.selectedAgentMode,
            qualityMode: ['speed', 'quality'].includes(parsed.qualityMode)
              ? parsed.qualityMode
              : defaultConfig.qualityMode,
            keys: { ...defaultConfig.keys, ...(parsed.keys || {}) },
            keyIndexes: { ...defaultConfig.keyIndexes, ...(parsed.keyIndexes || {}) },
          };

          // Bereinige Key Indexes
          (Object.keys(mergedConfig.keyIndexes) as AllAIProviders[]).forEach(provider => {
              const keyListLength = mergedConfig.keys[provider]?.length || 0;
              mergedConfig.keyIndexes[provider] = keyListLength > 0
                ? (mergedConfig.keyIndexes[provider] || 0) % keyListLength
                : 0;
          });

          setConfig(mergedConfig);
          console.log(`✅ AI-Config geladen (von ${CONFIG_STORAGE_KEY})`);
        } else {
          console.log(`ℹ️ Keine Config (${CONFIG_STORAGE_KEY}), verwende Defaults`);
          setConfig(getDefaultConfig());
        }
      } catch (e) {
        console.error('❌ Config Load Error:', e);
        setConfig(getDefaultConfig());
        await AsyncStorage.removeItem(CONFIG_STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, []);

  // Sicheres Speichern der Konfiguration
  const saveConfig = useCallback(async (newConfig: AIConfig | ((prev: AIConfig) => AIConfig)) => {
      const release = await saveMutex.acquire();
      try {
        const configToSave = typeof newConfig === 'function' ? newConfig(config) : newConfig;
        
        const finalConfig: AIConfig = { ...getDefaultConfig(), ...configToSave };

        (Object.keys(finalConfig.keyIndexes) as AllAIProviders[]).forEach(provider => {
          const keyListLength = finalConfig.keys[provider]?.length || 0;
          finalConfig.keyIndexes[provider] = keyListLength > 0 ? (finalConfig.keyIndexes[provider] || 0) % keyListLength : 0;
        });
        finalConfig.selectedChatProvider = 'groq';
        finalConfig.selectedAgentProvider = 'gemini';
        finalConfig.selectedChatMode = AVAILABLE_MODELS.groq.some(m=>m.id === finalConfig.selectedChatMode) ? finalConfig.selectedChatMode : getDefaultConfig().selectedChatMode;
        finalConfig.selectedAgentMode = AVAILABLE_MODELS.gemini.some(m=>m.id === finalConfig.selectedAgentMode) ? finalConfig.selectedAgentMode : getDefaultConfig().selectedAgentMode;
        finalConfig.qualityMode = ['speed','quality'].includes(finalConfig.qualityMode) ? finalConfig.qualityMode : getDefaultConfig().qualityMode;

        setConfig(finalConfig);
        AsyncStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(finalConfig)).catch(e => {
          console.error('❌ Config Save Error (async):', e);
        });

      } catch (e) {
        console.error('❌ saveConfig Error:', e);
      } finally {
        release();
      }
    }, [config]);

  // ---- Öffentliche Funktionen ----
  const updateConfig = useCallback(async (newPartialConfig: Partial<AIConfig>) => {
    await saveConfig(prev => ({ ...prev, ...newPartialConfig }));
  }, [saveConfig]);

  const setSelectedChatMode = useCallback(async (mode: AIMode) => {
    if (!AVAILABLE_MODELS.groq.some(m => m.id === mode)) {
      console.warn(`Ungültiges Chat-Modell: ${mode}`);
      Alert.alert('Ungültiges Modell', `${mode} ist nicht für Groq verfügbar.`);
      return;
    }
    console.log(`💬 Chat-Modell: ${mode}`);
    await updateConfig({ selectedChatMode: mode });
  }, [updateConfig]);

  const setSelectedAgentMode = useCallback(async (mode: AIMode) => {
    if (!AVAILABLE_MODELS.gemini.some(m => m.id === mode)) {
      console.warn(`Ungültiges Agent-Modell: ${mode}`);
      Alert.alert('Ungültiges Modell', `${mode} ist nicht für Gemini verfügbar.`);
      return;
    }
    console.log(`🤖 Agent-Modell: ${mode}`);
    await updateConfig({ selectedAgentMode: mode });
  }, [updateConfig]);

  const setQualityMode = useCallback(async (mode: QualityMode) => {
    if (mode !== 'speed' && mode !== 'quality') return;
    console.log(`⚙️ Qualitätsmodus: ${mode}`);
    await updateConfig({ qualityMode: mode });
  }, [updateConfig]);

  const addApiKey = useCallback(async (provider: AllAIProviders, key: string) => {
    const trimmedKey = key?.trim();
    if (!trimmedKey || !ALL_POSSIBLE_PROVIDERS.includes(provider)) return;
    await saveConfig(prev => {
      const keys = prev.keys[provider] || [];
      if (keys.includes(trimmedKey)) { Alert.alert('Info', 'Key existiert bereits'); return prev; }
      Alert.alert('Gespeichert', `${provider.toUpperCase()} Key hinzugefügt`);
      return { ...prev, keys: { ...prev.keys, [provider]: [...keys, trimmedKey] } };
    });
  }, [saveConfig]);

  const removeApiKey = useCallback(async (provider: AllAIProviders, keyToRemove: string) => {
    if (!ALL_POSSIBLE_PROVIDERS.includes(provider)) return;
    await saveConfig(prev => {
      const keys = prev.keys[provider] || [];
      const newKeys = keys.filter(k => k !== keyToRemove);
      if (newKeys.length === keys.length) return prev;
      const oldIndex = prev.keyIndexes[provider] || 0;
      const removedIdx = keys.indexOf(keyToRemove);
      let newIndex = oldIndex;
      if (removedIdx !== -1 && removedIdx < oldIndex) newIndex = Math.max(0, oldIndex - 1);
      newIndex = newKeys.length > 0 ? newIndex % newKeys.length : 0;
      Alert.alert('Gelöscht', `${provider.toUpperCase()} Key entfernt`);
      return { ...prev, keys: { ...prev.keys, [provider]: newKeys }, keyIndexes: { ...prev.keyIndexes, [provider]: newIndex } };
    });
  }, [saveConfig]);

  const getCurrentApiKey = useCallback((provider: AllAIProviders): string | null => {
    if (!config || !ALL_POSSIBLE_PROVIDERS.includes(provider)) return null;
    const keyList = config.keys[provider];
    if (!keyList || keyList.length === 0) return null;
    const idx = config.keyIndexes[provider] || 0;
    const validIdx = keyList.length > 0 ? idx % keyList.length : 0;
    return keyList[validIdx] ?? null;
  }, [config]);

  const rotateApiKey = useCallback(async (provider: AllAIProviders): Promise<string | null> => {
    if (!ALL_POSSIBLE_PROVIDERS.includes(provider)) return null;
    let nextKey: string | null = null;
    await saveConfig(prev => {
        const keyList = prev.keys[provider];
        if (!keyList || keyList.length < 2) { nextKey = keyList?.[0] || null; return prev; }
        const currentIdx = prev.keyIndexes[provider] || 0;
        const nextIdx = (currentIdx + 1) % keyList.length;
        nextKey = keyList[nextIdx];
        console.log(`🔑 Key rotiert (${provider}): ${currentIdx} → ${nextIdx}`);
        return { ...prev, keyIndexes: { ...prev.keyIndexes, [provider]: nextIdx } };
    });
    return nextKey;
  }, [saveConfig]);

  if (isLoading) return null;

  return (
    <AIContext.Provider value={{ config, isLoading, setSelectedChatMode, setSelectedAgentMode, setQualityMode, addApiKey, removeApiKey, rotateApiKey, getCurrentApiKey, updateConfig, }} >
      {children}
    </AIContext.Provider>
  );
};

export const useAI = () => {
  const context = useContext(AIContext);
  if (!context) { throw new Error('useAI muss innerhalb von AIProvider verwendet werden'); }
  return context;
};
