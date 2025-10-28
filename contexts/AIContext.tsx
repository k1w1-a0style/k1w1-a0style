import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export type AllAIProviders = 'groq' | 'gemini' | 'openai' | 'anthropic';
export type QualityMode = 'speed' | 'quality';

export const CHAT_PROVIDER: AllAIProviders = 'groq';
export const AGENT_PROVIDER: AllAIProviders = 'gemini';

interface ModelConfig {
  id: string;
  label: string;
}

// ✅ NUR ECHTE, BEWÄHRTE MODELLE
export const AVAILABLE_MODELS: Record<AllAIProviders, ModelConfig[]> = {
  groq: [
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Empfohlen)' },
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Schnell)' },
  ],
  gemini: [
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ],
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
  ],
};

interface AIConfig {
  keys: Record<AllAIProviders, string[]>;
  keyIndexes: Record<AllAIProviders, number>;
  selectedChatMode: string;
  selectedAgentMode: string;
  qualityMode: QualityMode;
}

const defaultConfig: AIConfig = {
  keys: { groq: [], gemini: [], openai: [], anthropic: [] },
  keyIndexes: { groq: 0, gemini: 0, openai: 0, anthropic: 0 },
  selectedChatMode: 'llama-3.3-70b-versatile', // ✅ ECHTES DEFAULT
  selectedAgentMode: 'gemini-2.0-flash',
  qualityMode: 'speed',
};

interface AIContextType {
  config: AIConfig;
  setSelectedChatMode: (mode: string) => Promise<void>;
  setSelectedAgentMode: (mode: string) => Promise<void>;
  setQualityMode: (mode: QualityMode) => Promise<void>;
  addApiKey: (provider: AllAIProviders, key: string) => Promise<void>;
  removeApiKey: (provider: AllAIProviders, key: string) => Promise<void>;
  getCurrentApiKey: (provider: AllAIProviders) => string | null;
  rotateApiKey: (provider: AllAIProviders) => Promise<string | null>;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

const STORAGE_KEY = 'ai_config_v1';

export const AIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AIConfig>(defaultConfig);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const merged = { ...defaultConfig, ...parsed };
        setConfig(merged);
        console.log('✅ AI-Config geladen (von ai_config_v1)');
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden der AI-Config:', error);
    }
  };

  const saveConfig = async (newConfig: AIConfig) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
      setConfig(newConfig);
    } catch (error) {
      console.error('❌ Fehler beim Speichern der AI-Config:', error);
    }
  };

  const setSelectedChatMode = async (mode: string) => {
    const newConfig = { ...config, selectedChatMode: mode };
    await saveConfig(newConfig);
    console.log('💬 Chat-Modell:', mode);
  };

  const setSelectedAgentMode = async (mode: string) => {
    const newConfig = { ...config, selectedAgentMode: mode };
    await saveConfig(newConfig);
    console.log('🤖 Agent-Modell:', mode);
  };

  const setQualityMode = async (mode: QualityMode) => {
    const newConfig = { ...config, qualityMode: mode };
    await saveConfig(newConfig);
    console.log('⚙️ Qualitätsmodus:', mode);
  };

  const addApiKey = async (provider: AllAIProviders, key: string) => {
    const currentKeys = config.keys[provider] || [];
    if (!currentKeys.includes(key)) {
      const newKeys = [...currentKeys, key];
      const newConfig = {
        ...config,
        keys: { ...config.keys, [provider]: newKeys },
      };
      await saveConfig(newConfig);
      console.log(`✅ ${provider.toUpperCase()} Key hinzugefügt`);
    }
  };

  const removeApiKey = async (provider: AllAIProviders, key: string) => {
    const currentKeys = config.keys[provider] || [];
    const newKeys = currentKeys.filter(k => k !== key);
    const currentIndex = config.keyIndexes[provider] || 0;
    const newIndex = currentIndex >= newKeys.length ? 0 : currentIndex;

    const newConfig = {
      ...config,
      keys: { ...config.keys, [provider]: newKeys },
      keyIndexes: { ...config.keyIndexes, [provider]: newIndex },
    };
    await saveConfig(newConfig);
    console.log(`🗑️ ${provider.toUpperCase()} Key entfernt`);
  };

  const getCurrentApiKey = (provider: AllAIProviders): string | null => {
    const keys = config.keys[provider] || [];
    if (keys.length === 0) return null;
    const index = config.keyIndexes[provider] || 0;
    return keys[index] || keys[0] || null;
  };

  const rotateApiKey = async (provider: AllAIProviders): Promise<string | null> => {
    const keys = config.keys[provider] || [];
    if (keys.length <= 1) return getCurrentApiKey(provider);

    const currentIndex = config.keyIndexes[provider] || 0;
    const nextIndex = (currentIndex + 1) % keys.length;

    const newConfig = {
      ...config,
      keyIndexes: { ...config.keyIndexes, [provider]: nextIndex },
    };
    await saveConfig(newConfig);

    console.log(`🔄 ${provider.toUpperCase()} Key rotiert: Index ${nextIndex}/${keys.length}`);
    return keys[nextIndex];
  };

  return (
    <AIContext.Provider
      value={{
        config,
        setSelectedChatMode,
        setSelectedAgentMode,
        setQualityMode,
        addApiKey,
        removeApiKey,
        getCurrentApiKey,
        rotateApiKey,
      }}
    >
      {children}
    </AIContext.Provider>
  );
};

export const useAI = () => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within AIProvider');
  }
  return context;
};
