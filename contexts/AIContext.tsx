import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export const SUPPORTED_PROVIDERS = ['groq', 'openai', 'gemini', 'anthropic'] as const;
export type AIProvider = typeof SUPPORTED_PROVIDERS[number];
export type AIMode = string;

export type ApiKeyList = Record<AIProvider, string[]>;
export type ApiKeyIndexMap = Record<AIProvider, number>;

export interface AIConfig {
  selectedProvider: AIProvider;
  selectedMode: AIMode;
  keys: ApiKeyList;
  keyIndexes: ApiKeyIndexMap;
}

interface AIContextProps {
  config: AIConfig;
  isLoading: boolean;
  setSelectedProvider: (provider: AIProvider) => Promise<void>;
  setSelectedMode: (mode: AIMode) => Promise<void>;
  addApiKey: (provider: AIProvider, key: string) => Promise<void>;
  removeApiKey: (provider: AIProvider, key: string) => Promise<void>;
  rotateApiKey: (provider: AIProvider) => Promise<string | null>;
  getCurrentApiKey: (provider: AIProvider) => string | null;
  updateConfig: (newConfig: Partial<AIConfig>) => Promise<void>;
}

const AIContext = createContext<AIContextProps | undefined>(undefined);

const CONFIG_STORAGE_KEY = 'ai_config_v1';

// ✅ FIX: Exportiert für UI-Komponenten
export const AVAILABLE_MODELS: Record<AIProvider, {id: string}[]> = {
  groq: [
    { id: 'auto-groq' },
    { id: 'openai/gpt-oss-20b' },
    { id: 'llama-3.3-70b-versatile' },
    { id: 'openai/gpt-oss-120b' },
    { id: 'llama-3.1-8b-instant' },
    { id: 'qwen/qwen3-32b' },
    { id: 'meta-llama/llama-4-scout-17b-16e-instruct' }
  ],
  openai: [
    { id: 'gpt-4.1' },
    { id: 'gpt-4o' },
    { id: 'gpt-3.5-turbo' }
  ],
  gemini: [
    { id: 'gemini-2.0-flash' },
    { id: 'gemini-1.5-pro-latest' },
    { id: 'gemini-1.5-flash-latest' }
  ],
  anthropic: [
    { id: 'claude-sonnet-4-5-20250929' },
    { id: 'claude-opus-4-1-20250805' },
    { id: 'claude-3-7-sonnet-20250219' },
    { id: 'claude-3-haiku-20240307' }
  ]
};

const getDefaultConfig = (): AIConfig => ({
  selectedProvider: 'groq',
  selectedMode: 'auto-groq',
  keys: {
    groq: [],
    openai: [],
    gemini: [],
    anthropic: []
  },
  keyIndexes: {
    groq: 0,
    openai: 0,
    gemini: 0,
    anthropic: 0
  }
});

export const AIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AIConfig>(getDefaultConfig());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      setIsLoading(true);
      try {
        const storedConfig = await AsyncStorage.getItem(CONFIG_STORAGE_KEY);
        if (storedConfig) {
          const parsed = JSON.parse(storedConfig);
          const defaultConfig = getDefaultConfig();

          const keys = { ...defaultConfig.keys, ...parsed.keys };
          const keyIndexes = { ...defaultConfig.keyIndexes, ...parsed.keyIndexes };

          const validProvider = SUPPORTED_PROVIDERS.includes(parsed.selectedProvider)
            ? parsed.selectedProvider
            : defaultConfig.selectedProvider;

          const providerModels = AVAILABLE_MODELS[validProvider] || [];
          const isValidMode = providerModels.some(m => m.id === parsed.selectedMode) ||
                             (validProvider === 'groq' && parsed.selectedMode === 'auto-groq');
          const validMode = isValidMode
            ? parsed.selectedMode
            : (validProvider === 'groq' ? 'auto-groq' : (providerModels[0]?.id || ''));

          setConfig({
            ...defaultConfig,
            ...parsed,
            selectedProvider: validProvider,
            selectedMode: validMode,
            keys,
            keyIndexes
          });
          console.log("AI-Konfiguration geladen.");
        } else {
          console.log("Keine AI-Konfiguration gefunden, verwende Standard.");
          setConfig(getDefaultConfig());
        }
      } catch (e) {
        console.error("Fehler beim Laden der AI-Konfiguration:", e);
        setConfig(getDefaultConfig());
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, []);

  const saveConfig = useCallback(async (newConfig: AIConfig | ((prevState: AIConfig) => AIConfig)) => {
    try {
      setConfig(prevConfig => {
        const configToSave = typeof newConfig === 'function' ? newConfig(prevConfig) : newConfig;

        (Object.keys(configToSave.keyIndexes) as AIProvider[]).forEach(provider => {
          if (SUPPORTED_PROVIDERS.includes(provider)) {
            const keyListLength = configToSave.keys[provider]?.length || 0;
            if (keyListLength === 0) {
              configToSave.keyIndexes[provider] = 0;
            } else {
              configToSave.keyIndexes[provider] = configToSave.keyIndexes[provider] % keyListLength;
            }
          } else {
            delete (configToSave.keys as any)[provider];
            delete (configToSave.keyIndexes as any)[provider];
          }
        });

        if (!SUPPORTED_PROVIDERS.includes(configToSave.selectedProvider)) {
          configToSave.selectedProvider = getDefaultConfig().selectedProvider;
          const providerModels = AVAILABLE_MODELS[configToSave.selectedProvider] || [];
          configToSave.selectedMode = configToSave.selectedProvider === 'groq'
            ? 'auto-groq'
            : (providerModels[0]?.id || '');
        }

        AsyncStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(configToSave)).catch(e => {
          console.error("Fehler beim asynchronen Speichern der AI-Konfiguration:", e);
        });

        return configToSave;
      });
    } catch (e) {
      console.error("Fehler beim Speichern der AI-Konfiguration:", e);
    }
  }, []);

  const updateConfig = useCallback(async (newConfig: Partial<AIConfig>) => {
    await saveConfig(prevConfig => ({ ...prevConfig, ...newConfig }));
  }, [saveConfig]);

  const setSelectedProvider = useCallback(async (provider: AIProvider) => {
    if (!SUPPORTED_PROVIDERS.includes(provider)) return;

    await saveConfig(prevConfig => {
      const currentMode = prevConfig.selectedMode;
      const providerModels = AVAILABLE_MODELS[provider] || [];
      const isModeValidForNewProvider = providerModels.some(m => m.id === currentMode) ||
                                       (provider === 'groq' && currentMode === 'auto-groq');

      let newMode = currentMode;
      if (!isModeValidForNewProvider) {
        newMode = provider === 'groq' ? 'auto-groq' : (providerModels[0]?.id || '');
        console.log(`Modus '${currentMode}' ungültig für ${provider}. Setze auf: '${newMode}'`);
      }

      console.log(`Provider gewechselt zu: ${provider}`);
      return { ...prevConfig, selectedProvider: provider, selectedMode: newMode };
    });
  }, [saveConfig]);

  const setSelectedMode = useCallback(async (mode: AIMode) => {
    await saveConfig(prevConfig => {
      const currentProvider = prevConfig.selectedProvider;
      const providerModels = AVAILABLE_MODELS[currentProvider] || [];
      const isValidMode = providerModels.some(m => m.id === mode) ||
                         (currentProvider === 'groq' && mode === 'auto-groq');

      if (isValidMode) {
        console.log(`Modus gespeichert: ${mode}`);
        return { ...prevConfig, selectedMode: mode };
      } else {
        console.warn(`Ungültiger Modus ${mode} für ${currentProvider}.`);
        Alert.alert("Ungültiger Modus", `Modus ${mode} ist für ${currentProvider} nicht verfügbar.`);
        return prevConfig;
      }
    });
  }, [saveConfig]);

  const addApiKey = useCallback(async (provider: AIProvider, key: string) => {
    if (!key || !SUPPORTED_PROVIDERS.includes(provider)) return;

    await saveConfig(prevConfig => {
      const newKeys = [...(prevConfig.keys[provider] || [])];
      if (newKeys.includes(key)) {
        Alert.alert("Key existiert bereits");
        return prevConfig;
      }
      newKeys.push(key);
      Alert.alert("Gespeichert", `${provider.toUpperCase()} Key hinzugefügt.`);
      return {
        ...prevConfig,
        keys: { ...prevConfig.keys, [provider]: newKeys }
      };
    });
  }, [saveConfig]);

  const removeApiKey = useCallback(async (provider: AIProvider, keyToRemove: string) => {
    if (!SUPPORTED_PROVIDERS.includes(provider)) return;

    await saveConfig(prevConfig => {
      const newKeys = (prevConfig.keys[provider] || []).filter(k => k !== keyToRemove);
      const newIndex = Math.max(0, prevConfig.keyIndexes[provider] % (newKeys.length || 1));

      Alert.alert("Gelöscht", `${provider.toUpperCase()} Key entfernt.`);
      return {
        ...prevConfig,
        keys: { ...prevConfig.keys, [provider]: newKeys },
        keyIndexes: { ...prevConfig.keyIndexes, [provider]: newIndex }
      };
    });
  }, [saveConfig]);

  const getCurrentApiKey = useCallback((provider: AIProvider): string | null => {
    if (!SUPPORTED_PROVIDERS.includes(provider)) return null;
    const keyList = config.keys[provider];
    if (!keyList || keyList.length === 0) return null;
    const currentIndex = config.keyIndexes[provider] || 0;
    return keyList[currentIndex % keyList.length];
  }, [config.keys, config.keyIndexes]);

  const rotateApiKey = useCallback(async (provider: AIProvider): Promise<string | null> => {
    if (!SUPPORTED_PROVIDERS.includes(provider)) return null;

    let nextKey: string | null = null;
    await saveConfig(prevConfig => {
      const keyList = prevConfig.keys[provider];
      if (!keyList || keyList.length < 2) {
        nextKey = null;
        return prevConfig;
      }

      const currentIndex = prevConfig.keyIndexes[provider] || 0;
      const nextIndex = (currentIndex + 1) % keyList.length;
      console.log(`API Key für ${provider} rotiert von Index ${currentIndex} zu Index ${nextIndex}`);
      nextKey = keyList[nextIndex];

      return {
        ...prevConfig,
        keyIndexes: { ...prevConfig.keyIndexes, [provider]: nextIndex }
      };
    });

    return nextKey;
  }, [saveConfig]);

  if (isLoading) {
    return null;
  }

  return (
    <AIContext.Provider value={{
      config,
      isLoading,
      setSelectedProvider,
      setSelectedMode,
      addApiKey,
      removeApiKey,
      rotateApiKey,
      getCurrentApiKey,
      updateConfig
    }}>
      {children}
    </AIContext.Provider>
  );
};

export const useAI = () => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI muss innerhalb eines AIProvider verwendet werden');
  }
  return context;
};
