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
// PROVIDER ROLES
// ============================================================================

export const CHAT_PROVIDER = 'groq' as const;
export const AGENT_PROVIDER = 'gemini' as const;

export const ACTIVE_PROVIDERS = [CHAT_PROVIDER, AGENT_PROVIDER] as const;
export type AIProvider = typeof ACTIVE_PROVIDERS[number];

const ALL_POSSIBLE_PROVIDERS = ['groq', 'openai', 'gemini', 'anthropic'] as const;
export type AllAIProviders = typeof ALL_POSSIBLE_PROVIDERS[number];

// ============================================================================
// TYPES
// ============================================================================

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
// CONSTANTS
// ============================================================================

const AIContext = createContext<AIContextProps | undefined>(undefined);
const CONFIG_STORAGE_KEY = 'ai_config_v2';

export const AVAILABLE_MODELS: Record<AllAIProviders, { id: string; label?: string }[]> = {
  groq: [
    { id: 'auto-groq', label: 'Auto (Empfohlen)' },
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B' },
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
  ],
  anthropic: [
    { id: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
    { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
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

  // Load config
  useEffect(() => {
    const loadConfig = async () => {
      setIsLoading(true);
      try {
        const storedConfig = await AsyncStorage.getItem(CONFIG_STORAGE_KEY);
        if (storedConfig) {
          const parsed = JSON.parse(storedConfig);
          const defaultConfig = getDefaultConfig();
          
          const mergedConfig: AIConfig = {
            ...defaultConfig,
            ...parsed,
            keys: { ...defaultConfig.keys, ...(parsed.keys || {}) },
            keyIndexes: { ...defaultConfig.keyIndexes, ...(parsed.keyIndexes || {}) },
            selectedChatProvider: 'groq',
            selectedAgentProvider: 'gemini',
            selectedChatMode: AVAILABLE_MODELS.groq.some(m => m.id === parsed.selectedChatMode)
              ? parsed.selectedChatMode
              : defaultConfig.selectedChatMode,
            selectedAgentMode: AVAILABLE_MODELS.gemini.some(m => m.id === parsed.selectedAgentMode)
              ? parsed.selectedAgentMode
              : defaultConfig.selectedAgentMode,
            qualityMode: ['speed', 'quality'].includes(parsed.qualityMode)
              ? parsed.qualityMode
              : defaultConfig.qualityMode,
          };
          
          setConfig(mergedConfig);
          console.log('✅ AI-Config geladen');
        } else {
          console.log('ℹ️ Keine Config, verwende Defaults');
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

  // Save config (with Mutex)
  const saveConfig = useCallback(async (newConfig: AIConfig | ((prev: AIConfig) => AIConfig)) => {
    const release = await saveMutex.acquire();
    try {
      const configToSave = typeof newConfig === 'function' ? newConfig(config) : newConfig;

      const finalKeys = { ...getDefaultConfig().keys, ...configToSave.keys };
      const finalKeyIndexes = { ...getDefaultConfig().keyIndexes };
      
      (Object.keys(finalKeys) as AllAIProviders[]).forEach(provider => {
        const keyListLength = finalKeys[provider]?.length || 0;
        finalKeyIndexes[provider] = keyListLength > 0
          ? (configToSave.keyIndexes[provider] || 0) % keyListLength
          : 0;
      });

      const finalConfig: AIConfig = {
        ...getDefaultConfig(),
        ...configToSave,
        keys: finalKeys,
        keyIndexes: finalKeyIndexes,
        selectedChatProvider: 'groq',
        selectedAgentProvider: 'gemini',
        selectedChatMode: AVAILABLE_MODELS.groq.some(m => m.id === configToSave.selectedChatMode)
          ? configToSave.selectedChatMode
          : getDefaultConfig().selectedChatMode,
        selectedAgentMode: AVAILABLE_MODELS.gemini.some(m => m.id === configToSave.selectedAgentMode)
          ? configToSave.selectedAgentMode
          : getDefaultConfig().selectedAgentMode,
        qualityMode: ['speed', 'quality'].includes(configToSave.qualityMode)
          ? configToSave.qualityMode
          : getDefaultConfig().qualityMode,
      };

      setConfig(finalConfig);
      
      AsyncStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(finalConfig)).catch(e => {
        console.error('❌ Config Save Error:', e);
      });

    } catch (e) {
      console.error('❌ saveConfig Error:', e);
    } finally {
      release();
    }
  }, [config]);

  const updateConfig = useCallback(async (newPartialConfig: Partial<AIConfig>) => {
    await saveConfig(prevConfig => ({ ...prevConfig, ...newPartialConfig }));
  }, [saveConfig]);

  const setSelectedChatMode = useCallback(async (mode: AIMode) => {
    if (!AVAILABLE_MODELS.groq.some(m => m.id === mode)) {
      console.warn(`Ungültiges Chat-Modell: ${mode}`);
      Alert.alert('Ungültiges Modell', `${mode} ist nicht verfügbar`);
      return;
    }
    console.log(`💬 Chat-Modell: ${mode}`);
    await updateConfig({ selectedChatMode: mode });
  }, [updateConfig]);

  const setSelectedAgentMode = useCallback(async (mode: AIMode) => {
    if (!AVAILABLE_MODELS.gemini.some(m => m.id === mode)) {
      console.warn(`Ungültiges Agent-Modell: ${mode}`);
      Alert.alert('Ungültiges Modell', `${mode} ist nicht verfügbar`);
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
    if (!key || !ALL_POSSIBLE_PROVIDERS.includes(provider)) return;
    
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      Alert.alert('Fehler', 'API Key darf nicht leer sein');
      return;
    }

    await saveConfig(prevConfig => {
      const currentKeys = prevConfig.keys[provider] || [];
      if (currentKeys.includes(trimmedKey)) {
        Alert.alert('Info', `${provider.toUpperCase()} Key existiert bereits`);
        return prevConfig;
      }
      
      const newKeys = [...currentKeys, trimmedKey];
      Alert.alert('Gespeichert', `${provider.toUpperCase()} Key hinzugefügt`);
      
      return {
        ...prevConfig,
        keys: { ...prevConfig.keys, [provider]: newKeys },
      };
    });
  }, [saveConfig]);

  const removeApiKey = useCallback(async (provider: AllAIProviders, keyToRemove: string) => {
    if (!ALL_POSSIBLE_PROVIDERS.includes(provider)) return;
    
    await saveConfig(prevConfig => {
      const currentKeys = prevConfig.keys[provider] || [];
      const newKeys = currentKeys.filter(k => k !== keyToRemove);
      
      if (newKeys.length === currentKeys.length) return prevConfig;

      const oldIndex = prevConfig.keyIndexes[provider] || 0;
      const removedKeyIndex = currentKeys.indexOf(keyToRemove);
      let newIndex = oldIndex;
      
      if (removedKeyIndex !== -1 && removedKeyIndex < oldIndex) {
        newIndex = Math.max(0, oldIndex - 1);
      }
      newIndex = newKeys.length > 0 ? newIndex % newKeys.length : 0;

      Alert.alert('Gelöscht', `${provider.toUpperCase()} Key entfernt`);
      
      return {
        ...prevConfig,
        keys: { ...prevConfig.keys, [provider]: newKeys },
        keyIndexes: { ...prevConfig.keyIndexes, [provider]: newIndex },
      };
    });
  }, [saveConfig]);

  const getCurrentApiKey = useCallback((provider: AllAIProviders): string | null => {
    if (!config || !ALL_POSSIBLE_PROVIDERS.includes(provider)) return null;
    
    const keyList = config.keys[provider];
    if (!keyList || keyList.length === 0) return null;
    
    const currentIndex = config.keyIndexes[provider] || 0;
    const validIndex = keyList.length > 0 ? currentIndex % keyList.length : 0;
    
    return keyList[validIndex] ?? null;
  }, [config]);

  const rotateApiKey = useCallback(async (provider: AllAIProviders): Promise<string | null> => {
    if (!ALL_POSSIBLE_PROVIDERS.includes(provider)) return null;

    let nextKey: string | null = null;

    await saveConfig(prevConfig => {
      const keyList = prevConfig.keys[provider];
      
      if (!keyList || keyList.length < 2) {
        nextKey = keyList?.[0] || null;
        return prevConfig;
      }
      
      const currentIndex = prevConfig.keyIndexes[provider] || 0;
      const nextIndex = (currentIndex + 1) % keyList.length;
      nextKey = keyList[nextIndex];
      
      console.log(`🔑 Key rotiert (${provider}): ${currentIndex} → ${nextIndex}`);
      
      return {
        ...prevConfig,
        keyIndexes: { ...prevConfig.keyIndexes, [provider]: nextIndex },
      };
    });

    return nextKey;
  }, [saveConfig]);

  if (isLoading) return null;

  return (
    <AIContext.Provider
      value={{
        config,
        isLoading,
        setSelectedChatMode,
        setSelectedAgentMode,
        setQualityMode,
        addApiKey,
        removeApiKey,
        rotateApiKey,
        getCurrentApiKey,
        updateConfig,
      }}
    >
      {children}
    </AIContext.Provider>
  );
};

export const useAI = () => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI muss innerhalb von AIProvider verwendet werden');
  }
  return context;
};
