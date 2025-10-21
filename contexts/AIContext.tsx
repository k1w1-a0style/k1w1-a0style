import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

// Definiere die unterstützten Provider und den Modus-Typ
export const SUPPORTED_PROVIDERS = ['groq', 'openai', 'gemini', 'anthropic'] as const;
export type AIProvider = typeof SUPPORTED_PROVIDERS[number];
export type AIMode = string; // z.B. 'auto-groq' or 'gpt-4.1'

// Typen für die Key-Verwaltung
export type ApiKeyList = Record<AIProvider, string[]>;
export type ApiKeyIndexMap = Record<AIProvider, number>;

// Typ für die gesamte Konfiguration
export interface AIConfig {
  selectedProvider: AIProvider;
  selectedMode: AIMode;
  keys: ApiKeyList;
  keyIndexes: ApiKeyIndexMap;
}

// Typ für den Context-Wert
interface AIContextProps {
  config: AIConfig;
  isLoading: boolean;
  setSelectedProvider: (provider: AIProvider) => Promise<void>;
  setSelectedMode: (mode: AIMode) => Promise<void>;
  addApiKey: (provider: AIProvider, key: string) => Promise<void>;
  removeApiKey: (provider: AIProvider, key: string) => Promise<void>;
  rotateApiKey: (provider: AIProvider) => Promise<string | null>;
  getCurrentApiKey: (provider: AIProvider) => string | null;
}

// Erstelle den Context
const AIContext = createContext<AIContextProps | undefined>(undefined);
const CONFIG_STORAGE_KEY = 'ai_config_v1';

// Standardkonfiguration (wird nur beim allerersten Start oder bei Ladefehlern verwendet)
const getDefaultConfig = (): AIConfig => ({
  selectedProvider: 'groq',
  selectedMode: 'auto-groq', // Standardmodus
  keys: { groq: [], openai: [], gemini: [], anthropic: [] },
  keyIndexes: { groq: 0, openai: 0, gemini: 0, anthropic: 0 }
});

// AIProvider Komponente
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
          // Fülle fehlende Provider oder Keys/Indizes mit Standardwerten auf
          const defaultConfig = getDefaultConfig();
          const keys = { ...defaultConfig.keys, ...parsed.keys };
          const keyIndexes = { ...defaultConfig.keyIndexes, ...parsed.keyIndexes };
          // WICHTIG: Stelle sicher, dass der Provider unterstützt wird, sonst Fallback
          const validProvider = SUPPORTED_PROVIDERS.includes(parsed.selectedProvider)
            ? parsed.selectedProvider
            : defaultConfig.selectedProvider;
         // WICHTIG: Stelle sicher, dass der Modus für den Provider gültig ist, sonst Fallback
          const providerModels = AVAILABLE_MODELS_INTERNAL[validProvider] || [];
          const isValidMode = providerModels.some(m => m.id === parsed.selectedMode) || (validProvider === 'groq' && parsed.selectedMode === 'auto-groq');
          const validMode = isValidMode
            ? parsed.selectedMode
            : (validProvider === 'groq' ? 'auto-groq' : (providerModels[0]?.id || '')); // Fallback zum ersten Modell oder auto-groq

          setConfig({ ...defaultConfig, ...parsed, selectedProvider: validProvider, selectedMode: validMode, keys, keyIndexes });
          console.log("AI-Konfiguration geladen.");
        } else {
          console.log("Keine AI-Konfiguration gefunden, verwende Standard.");
          setConfig(getDefaultConfig());
        }
      } catch (e) {
        console.error("Fehler beim Laden der AI-Konfiguration:", e);
        setConfig(getDefaultConfig()); // Fallback bei Fehler
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, []);

  // Speicher-Helfer
  const saveConfig = async (newConfig: AIConfig) => {
    try {
      // Index-Bereinigung vor dem Speichern
      (Object.keys(newConfig.keyIndexes) as AIProvider[]).forEach(provider => {
         // Nur fortfahren, wenn der Provider noch unterstützt wird
         if (SUPPORTED_PROVIDERS.includes(provider)) {
            const keyListLength = newConfig.keys[provider]?.length || 0;
            if (keyListLength === 0) {
              newConfig.keyIndexes[provider] = 0;
            } else {
              newConfig.keyIndexes[provider] = newConfig.keyIndexes[provider] % keyListLength;
            }
         } else {
            // Entferne Daten für nicht mehr unterstützte Provider (optional, aber sauber)
            delete newConfig.keys[provider];
            delete newConfig.keyIndexes[provider];
         }
      });
      
      // Stelle sicher, dass der ausgewählte Provider noch gültig ist
      if (!SUPPORTED_PROVIDERS.includes(newConfig.selectedProvider)) {
          newConfig.selectedProvider = getDefaultConfig().selectedProvider; // Fallback
          // Setze auch den Modus auf einen gültigen Standard zurück
          const providerModels = AVAILABLE_MODELS_INTERNAL[newConfig.selectedProvider] || [];
           newConfig.selectedMode = newConfig.selectedProvider === 'groq' ? 'auto-groq' : (providerModels[0]?.id || '');
      }


      await AsyncStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
      setConfig(newConfig); // Aktualisiere den State
    } catch (e) {
      console.error("Fehler beim Speichern der AI-Konfiguration:", e);
    }
  };

  // --- Context-Funktionen ---

  // === FINALER FIX: setSelectedProvider ===
  // Ändert NUR den Provider. Der Modus bleibt unverändert.
  const setSelectedProvider = async (provider: AIProvider) => {
    if (!SUPPORTED_PROVIDERS.includes(provider)) {
       console.warn(`Ungültiger Provider ausgewählt: ${provider}`);
       return;
    }
    // Überprüfe, ob der aktuelle Modus für den neuen Provider gültig ist.
    // Wenn nicht, setze ihn auf einen Standardwert für diesen Provider.
    const currentMode = config.selectedMode;
    const providerModels = AVAILABLE_MODELS_INTERNAL[provider] || [];
    const isModeValidForNewProvider = providerModels.some(m => m.id === currentMode) || (provider === 'groq' && currentMode === 'auto-groq');

    let newMode = currentMode;
    if (!isModeValidForNewProvider) {
        newMode = provider === 'groq' ? 'auto-groq' : (providerModels[0]?.id || ''); // Standard für den neuen Provider
        console.log(`Modus '${currentMode}' ist für Provider '${provider}' ungültig. Setze auf Standard: '${newMode}'`);
    }

    console.log(`Provider gewechselt zu: ${provider}`);
    await saveConfig({ ...config, selectedProvider: provider, selectedMode: newMode }); // Speichere den neuen Provider und den (ggf. angepassten) Modus
};
  // === ENDE FINALER FIX ===


  const setSelectedMode = async (mode: AIMode) => {
    // Validiere den Modus gegen den *aktuell* ausgewählten Provider
    const currentProvider = config.selectedProvider;
    const providerModels = AVAILABLE_MODELS_INTERNAL[currentProvider] || [];
    const isValidMode = providerModels.some(m => m.id === mode) || (currentProvider === 'groq' && mode === 'auto-groq');

    if (isValidMode) {
      console.log(`Modus gespeichert: ${mode}`);
      await saveConfig({ ...config, selectedMode: mode });
    } else {
      console.warn(`Versuch, ungültigen Modus '${mode}' für Provider '${currentProvider}' zu setzen.`);
      Alert.alert("Ungültiger Modus", `Der Modus '${mode}' ist für den Anbieter '${currentProvider}' nicht verfügbar.`);
      // Optional: Nichts tun oder auf Standard zurücksetzen? Aktuell: Nichts tun.
    }
  };


  const addApiKey = async (provider: AIProvider, key: string) => {
    if (!key || !SUPPORTED_PROVIDERS.includes(provider)) return;
    const newKeys = [...(config.keys[provider] || [])];
    if (newKeys.includes(key)) {
      Alert.alert("Key existiert bereits", "Dieser Key ist bereits gespeichert.");
      return;
    }
    newKeys.push(key);
    await saveConfig({ ...config, keys: { ...config.keys, [provider]: newKeys } });
    Alert.alert("Gespeichert", `${provider.toUpperCase()} Key hinzugefügt.`);
  };

  const removeApiKey = async (provider: AIProvider, keyToRemove: string) => {
     if (!SUPPORTED_PROVIDERS.includes(provider)) return;
    const newKeys = (config.keys[provider] || []).filter(k => k !== keyToRemove);
    const newIndex = Math.max(0, config.keyIndexes[provider] % (newKeys.length || 1));
    
    await saveConfig({
      ...config,
      keys: { ...config.keys, [provider]: newKeys },
      keyIndexes: { ...config.keyIndexes, [provider]: newIndex }
    });
    Alert.alert("Gelöscht", `${provider.toUpperCase()} Key entfernt.`);
  };

  const getCurrentApiKey = (provider: AIProvider): string | null => {
     if (!SUPPORTED_PROVIDERS.includes(provider)) return null;
    const keyList = config.keys[provider];
    if (!keyList || keyList.length === 0) return null;
    const currentIndex = config.keyIndexes[provider] || 0;
    return keyList[currentIndex % keyList.length];
  };

  const rotateApiKey = async (provider: AIProvider): Promise<string | null> => {
    if (!SUPPORTED_PROVIDERS.includes(provider)) return null;
    const keyList = config.keys[provider];
    if (!keyList || keyList.length < 2) return null;

    const currentIndex = config.keyIndexes[provider] || 0;
    const nextIndex = (currentIndex + 1) % keyList.length;

    await saveConfig({
      ...config,
      keyIndexes: { ...config.keyIndexes, [provider]: nextIndex }
    });
    console.log(`API Key für ${provider} rotiert zu Index ${nextIndex}`);

    return keyList[nextIndex];
  };

  // Warte, bis die Konfiguration geladen ist
  if (isLoading) return null;

  // Stelle den Context bereit
  return (
    <AIContext.Provider value={{
      config,
      isLoading,
      setSelectedProvider,
      setSelectedMode,
      addApiKey,
      removeApiKey,
      rotateApiKey,
      getCurrentApiKey
    }}>
      {children}
    </AIContext.Provider>
  );
};

// Hook zur Verwendung des Contexts
export const useAI = () => {
  const context = useContext(AIContext);
  if (!context) { throw new Error('useAI muss innerhalb eines AIProvider verwendet werden'); }
  return context;
};


// Interne Kopie der Modell-Definitionen, um Zirkelabhängigkeit zu vermeiden
// Diese MUSS mit der in SettingsScreen.tsx übereinstimmen!
const AVAILABLE_MODELS_INTERNAL: Record<AIProvider, {id: string, name: string, description: string, provider: AIProvider}[]> = {
  groq: [ { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', description: 'Schnell, groß, stabil (Code)', provider: 'groq' }, { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Stark bei UI/UX & Code', provider: 'groq' }, { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', description: 'Starkes log. Denken (Debug)', provider: 'groq' }, { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: 'Sehr schnell & günstig (Snippets)', provider: 'groq' }, { id: 'qwen/qwen3-32b', name: 'Qwen3 32B', description: 'Alternatives Allrounder-Modell', provider: 'groq' }, { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout', description: 'Neues Scout-Modell', provider: 'groq' } ],
  openai: [ { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Hohe Code-Qualität & Refactoring', provider: 'openai' }, { id: 'gpt-4o', name: 'GPT-4o', description: 'Neuestes Omni-Modell', provider: 'openai' }, { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Standard (für Keys mit Limit)', provider: 'openai' } ],
  gemini: [ { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Schnell & effizient (verfügbar)', provider: 'gemini' }, { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro', description: 'Großes Kontextfenster (1M+)', provider: 'gemini' }, { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash', description: 'Schnelle Variante', provider: 'gemini' } ],
  anthropic: [ { id: 'claude-sonnet-4-5-20250929', name: 'Claude 4.5 Sonnet', description: 'Neuestes Sonnet (Coding)', provider: 'anthropic' }, { id: 'claude-opus-4-1-20250805', name: 'Claude 4.1 Opus', description: 'Neuestes Top-Modell (Komplex)', provider: 'anthropic' }, { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', description: 'Guter Allrounder', provider: 'anthropic' }, { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Schnellstes & günstigstes Modell', provider: 'anthropic' } ]
};
