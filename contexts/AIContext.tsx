import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export const SUPPORTED_PROVIDERS = ['groq', 'openai', 'gemini', 'anthropic', 'perplexity'] as const;
export type AIProvider = typeof SUPPORTED_PROVIDERS[number];

export type AIMode = string; // Kann eine Model-ID oder 'auto-groq' sein

const DEFAULT_PROVIDER: AIProvider = 'groq';
const DEFAULT_MODE: AIMode = 'auto-groq';

const PROVIDER_STORAGE_KEY = 'selected_ai_provider';
const MODE_STORAGE_KEY = 'selected_ai_mode';

interface AIContextProps {
  selectedProvider: AIProvider;
  setSelectedProvider: (provider: AIProvider) => Promise<void>;
  selectedMode: AIMode;
  setSelectedMode: (mode: AIMode) => Promise<void>;
}

const AIContext = createContext<AIContextProps | undefined>(undefined);

interface AIProviderProps {
  children: ReactNode;
}

export const AIProvider: React.FC<AIProviderProps> = ({ children }) => {
  const [selectedProvider, setSelectedProviderState] = useState<AIProvider>(DEFAULT_PROVIDER);
  const [selectedMode, setSelectedModeState] = useState<AIMode>(DEFAULT_MODE);
  const [isLoading, setIsLoading] = useState(true);

  const handleSetSelectedMode = useCallback(async (mode: AIMode) => {
    try {
      await AsyncStorage.setItem(MODE_STORAGE_KEY, mode);
      setSelectedModeState(mode);
      console.log(`Modus gespeichert: ${mode}`);
    } catch (e) { console.error("Fehler Speichern Modus:", e); }
  }, []);

  const handleSetSelectedProvider = useCallback(async (provider: AIProvider) => {
    if (!SUPPORTED_PROVIDERS.includes(provider)) return;
    try {
      await AsyncStorage.setItem(PROVIDER_STORAGE_KEY, provider);
      setSelectedProviderState(provider);
      const defaultModeForProvider = provider === 'groq' ? 'auto-groq' : provider;
      await handleSetSelectedMode(defaultModeForProvider);
      console.log(`Provider gespeichert: ${provider}, Modus: ${defaultModeForProvider}`);
    } catch (e) { console.error("Fehler Speichern Provider:", e); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // handleSetSelectedMode MUSS hier weg

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      let finalProvider = DEFAULT_PROVIDER;
      let finalMode = DEFAULT_MODE;
      try {
        const storedProvider = await AsyncStorage.getItem(PROVIDER_STORAGE_KEY) as AIProvider | null;
        const storedMode = await AsyncStorage.getItem(MODE_STORAGE_KEY) as AIMode | null;

        if (storedProvider && SUPPORTED_PROVIDERS.includes(storedProvider)) {
          finalProvider = storedProvider;
        }
        if (storedMode) {
          finalMode = storedMode;
        } else {
          finalMode = finalProvider === 'groq' ? 'auto-groq' : finalProvider;
        }
        console.log(`Geladen: Provider=${finalProvider}, Mode=${finalMode}`);
      } catch (e) { console.error("Fehler Laden AI Settings:", e);
      } finally {
        setSelectedProviderState(finalProvider);
        setSelectedModeState(finalMode);
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);


  if (isLoading) return null;

  return (
    <AIContext.Provider value={{ selectedProvider, setSelectedProvider: handleSetSelectedProvider, selectedMode, setSelectedMode: handleSetSelectedMode }}>
      {children}
    </AIContext.Provider>
  );
};

export const useAI = () => {
  const context = useContext(AIContext);
  if (!context) { throw new Error('useAI muss innerhalb eines AIProvider verwendet werden'); }
  return context;
};
