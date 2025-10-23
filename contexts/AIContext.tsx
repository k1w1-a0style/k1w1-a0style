import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { ProjectFile } from './ProjectContext'; // Importiere Typ, falls nötig (für AVAILABLE_MODELS_INTERNAL)

// ... (Andere Typen: SUPPORTED_PROVIDERS, AIProvider, AIMode, ApiKeyList, etc. bleiben gleich) ...
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
}
const AIContext = createContext<AIContextProps | undefined>(undefined);
const CONFIG_STORAGE_KEY = 'ai_config_v1';
const getDefaultConfig = (): AIConfig => ({
  selectedProvider: 'groq',
  selectedMode: 'auto-groq',
  keys: { groq: [], openai: [], gemini: [], anthropic: [] },
  keyIndexes: { groq: 0, openai: 0, gemini: 0, anthropic: 0 }
});
// --- (Ende der unveränderten Definitionen) ---

export const AIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AIConfig>(getDefaultConfig());
  const [isLoading, setIsLoading] = useState(true);

  // Lade Konfiguration (unverändert)
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
          
          // Fallback-Logik für geladenen Modus (wichtig)
          const validProvider = SUPPORTED_PROVIDERS.includes(parsed.selectedProvider) ? parsed.selectedProvider : defaultConfig.selectedProvider;
          const providerModels = AVAILABLE_MODELS_INTERNAL[validProvider] || [];
          const isValidMode = providerModels.some(m => m.id === parsed.selectedMode) || (validProvider === 'groq' && parsed.selectedMode === 'auto-groq');
          const validMode = isValidMode ? parsed.selectedMode : (validProvider === 'groq' ? 'auto-groq' : (providerModels[0]?.id || ''));

          setConfig({ ...defaultConfig, ...parsed, selectedProvider: validProvider, selectedMode: validMode, keys, keyIndexes });
          console.log("AI-Konfiguration geladen.");
        } else {
          console.log("Keine AI-Konfiguration gefunden, verwende Standard.");
          setConfig(getDefaultConfig());
        }
      } catch (e) { console.error("Fehler beim Laden der AI-Konfiguration:", e); setConfig(getDefaultConfig()); }
      finally { setIsLoading(false); }
    };
    loadConfig();
  }, []);

  // --- KORRIGIERTE saveConfig Funktion ---
  const saveConfig = async (newConfig: AIConfig | ((prevState: AIConfig) => AIConfig)) => {
    try {
      // Wende die neue Konfiguration an. Wenn es eine Funktion ist, wende sie auf den aktuellen State an.
      const configToSave = typeof newConfig === 'function' ? newConfig(config) : newConfig;

      // Bereinige Indizes (unverändert)
      (Object.keys(configToSave.keyIndexes) as AIProvider[]).forEach(provider => {
         if (SUPPORTED_PROVIDERS.includes(provider)) {
            const keyListLength = configToSave.keys[provider]?.length || 0;
            if (keyListLength === 0) { configToSave.keyIndexes[provider] = 0; }
            else { configToSave.keyIndexes[provider] = configToSave.keyIndexes[provider] % keyListLength; }
         } else {
            delete configToSave.keys[provider]; delete configToSave.keyIndexes[provider];
         }
      });
      
      // Provider-Fallback (unverändert)
      if (!SUPPORTED_PROVIDERS.includes(configToSave.selectedProvider)) {
          configToSave.selectedProvider = getDefaultConfig().selectedProvider;
          const providerModels = AVAILABLE_MODELS_INTERNAL[configToSave.selectedProvider] || [];
          configToSave.selectedMode = configToSave.selectedProvider === 'groq' ? 'auto-groq' : (providerModels[0]?.id || '');
      }

      // Speichere im AsyncStorage (unverändert)
      await AsyncStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(configToSave));
      
      // === BUGFIX: Verwende funktionales Update für setConfig ===
      // Dies stellt sicher, dass wir *immer* den neuesten State als Basis nehmen
      setConfig(configToSave);
      // === ENDE BUGFIX ===

    } catch (e) {
      console.error("Fehler beim Speichern der AI-Konfiguration:", e);
    }
  };
  // --- ENDE KORRIGIERTE saveConfig Funktion ---


  // --- Context-Funktionen (nutzen jetzt das korrigierte saveConfig) ---

  const setSelectedProvider = async (provider: AIProvider) => {
    // ... (unverändert) ...
    if (!SUPPORTED_PROVIDERS.includes(provider)) return;
    const currentMode = config.selectedMode;
    const providerModels = AVAILABLE_MODELS_INTERNAL[provider] || [];
    const isModeValidForNewProvider = providerModels.some(m => m.id === currentMode) || (provider === 'groq' && currentMode === 'auto-groq');
    let newMode = currentMode;
    if (!isModeValidForNewProvider) {
        newMode = provider === 'groq' ? 'auto-groq' : (providerModels[0]?.id || '');
        console.log(`Modus '${currentMode}' ungültig für ${provider}. Setze auf: '${newMode}'`);
    }
    console.log(`Provider gewechselt zu: ${provider}`);
    await saveConfig({ ...config, selectedProvider: provider, selectedMode: newMode });
  };

  const setSelectedMode = async (mode: AIMode) => {
    // ... (unverändert) ...
     const currentProvider = config.selectedProvider;
     const providerModels = AVAILABLE_MODELS_INTERNAL[currentProvider] || [];
     const isValidMode = providerModels.some(m => m.id === mode) || (currentProvider === 'groq' && mode === 'auto-groq');
     if (isValidMode) { console.log(`Modus gespeichert: ${mode}`); await saveConfig({ ...config, selectedMode: mode }); }
     else { console.warn(`Ungültiger Modus ${mode} für ${currentProvider}.`); Alert.alert("Ungültiger Modus", `Modus ${mode} ist für ${currentProvider} nicht verfügbar.`); }
  };

  const addApiKey = async (provider: AIProvider, key: string) => {
    // ... (unverändert) ...
    if (!key || !SUPPORTED_PROVIDERS.includes(provider)) return;
    const newKeys = [...(config.keys[provider] || [])];
    if (newKeys.includes(key)) { Alert.alert("Key existiert bereits"); return; }
    newKeys.push(key);
    await saveConfig({ ...config, keys: { ...config.keys, [provider]: newKeys } });
    Alert.alert("Gespeichert", `${provider.toUpperCase()} Key hinzugefügt.`);
  };

  const removeApiKey = async (provider: AIProvider, keyToRemove: string) => {
    // ... (unverändert) ...
     if (!SUPPORTED_PROVIDERS.includes(provider)) return;
    const newKeys = (config.keys[provider] || []).filter(k => k !== keyToRemove);
    const newIndex = Math.max(0, config.keyIndexes[provider] % (newKeys.length || 1));
    await saveConfig({ ...config, keys: { ...config.keys, [provider]: newKeys }, keyIndexes: { ...config.keyIndexes, [provider]: newIndex } });
    Alert.alert("Gelöscht", `${provider.toUpperCase()} Key entfernt.`);
  };

  const getCurrentApiKey = (provider: AIProvider): string | null => {
    // ... (unverändert) ...
     if (!SUPPORTED_PROVIDERS.includes(provider)) return null;
    const keyList = config.keys[provider];
    if (!keyList || keyList.length === 0) return null;
    const currentIndex = config.keyIndexes[provider] || 0;
    return keyList[currentIndex % keyList.length];
  };

  // --- KORRIGIERTE rotateApiKey Funktion ---
  const rotateApiKey = async (provider: AIProvider): Promise<string | null> => {
    if (!SUPPORTED_PROVIDERS.includes(provider)) return null;

    let nextKey: string | null = null;

    // === BUGFIX: Verwende funktionales setConfig ===
    // Wir übergeben setConfig eine Funktion, die den *aktuellsten* State (prevState) erhält
    await setConfig(prevState => {
        const keyList = prevState.keys[provider];
        if (!keyList || keyList.length < 2) {
            nextKey = null; // Rotation sinnlos
            return prevState; // Gib alten State zurück
        }

        const currentIndex = prevState.keyIndexes[provider] || 0;
        const nextIndex = (currentIndex + 1) % keyList.length;
        
        console.log(`API Key für ${provider} rotiert von Index ${currentIndex} zu Index ${nextIndex}`);
        nextKey = keyList[nextIndex]; // Setze den nächsten Key für die Rückgabe

        // Erstelle den neuen State basiert auf prevState
        const newState = {
            ...prevState,
            keyIndexes: {
                ...prevState.keyIndexes,
                [provider]: nextIndex
            }
        };

        // Speichere den neuen State asynchron im AsyncStorage (ohne await hier drin)
        AsyncStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newState))
            .catch(e => console.error("Fehler beim Speichern (rotateApiKey):", e));

        return newState; // Gib den neuen State zurück
    });
    // === ENDE BUGFIX ===

    return nextKey; // Gib den ermittelten nächsten Key zurück
  };
  // --- ENDE KORRIGIERTE rotateApiKey Funktion ---

  if (isLoading) return null;

  return (
    <AIContext.Provider value={{
      config, isLoading, setSelectedProvider, setSelectedMode,
      addApiKey, removeApiKey, rotateApiKey, getCurrentApiKey
    }}>
      {children}
    </AIContext.Provider>
  );
};

export const useAI = () => {
  const context = useContext(AIContext);
  if (!context) { throw new Error('useAI muss innerhalb eines AIProvider verwendet werden'); }
  return context;
};

// Interne Kopie der Modell-Definitionen (unverändert)
const AVAILABLE_MODELS_INTERNAL: Record<AIProvider, {id: string, name: string}[]> = {
  groq: [ { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B'}, { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B'}, { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B'}, { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B'}, { id: 'qwen/qwen3-32b', name: 'Qwen3 32B'}, { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout'} ],
  openai: [ { id: 'gpt-4.1', name: 'GPT-4.1'}, { id: 'gpt-4o', name: 'GPT-4o'}, { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo'} ],
  gemini: [ { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash'}, { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro'}, { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash'} ],
  anthropic: [ { id: 'claude-sonnet-4-5-20250929', name: 'Claude 4.5 Sonnet'}, { id: 'claude-opus-4-1-20250805', name: 'Claude 4.1 Opus'}, { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet'}, { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku'} ]
};

