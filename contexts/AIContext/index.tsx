// contexts/AIContext/index.tsx
// REFACTORED: models + types → models.ts, helpers → helpers.ts

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SecureKeyManager from '../../lib/SecureKeyManager';

// Re-export types & constants so existing imports from "AIContext" keep working
export type {
  AllAIProviders, QualityMode, ModelTier, ProviderLimitStatus,
  ModelInfo, ProviderDefaults, ProviderMetadata, AIConfig, AIContextProps,
} from "./models";
export { PROVIDER_DEFAULTS, PROVIDER_METADATA, AVAILABLE_MODELS } from "./models";

import type { AIConfig, AIContextProps, AllAIProviders, ProviderLimitStatus, QualityMode } from "./models";
import { PROVIDER_DEFAULTS } from "./models";
import {
  CONFIG_STORAGE_KEY, DEFAULT_CONFIG,
  loadConfig, loadSecureApiKeys, saveSecureApiKeys,
  getDefaultMode,
  resolveProviderModeForQualityMode,
} from "./helpers";

const AIContext = createContext<AIContextProps | undefined>(undefined);

export function AIProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfigState] = useState<AIConfig>(DEFAULT_CONFIG);
  const [providerStatus, setProviderStatus] = useState<ProviderLimitStatus[]>([]);
  const didLoad = useRef(false);
  const persistRotationInProgress = useRef(false);

  
useEffect(() => {
  (async () => {
    try {
      const loaded = (await loadConfig()) ?? DEFAULT_CONFIG;

      // Load keys from SecureStore (authoritative)
      const secureKeys = await loadSecureApiKeys();

      // Legacy migration: if SecureStore empty but config contains keys, migrate them once
      const hasSecureAny = (Object.keys(secureKeys) as AllAIProviders[]).some(
        (p) => (secureKeys[p] ?? []).length > 0,
      );
      const hasLegacyAny = (Object.keys(loaded.apiKeys) as AllAIProviders[]).some(
        (p) => (loaded.apiKeys[p] ?? []).length > 0,
      );

      let finalKeys = secureKeys;
      if (!hasSecureAny && hasLegacyAny) {
        finalKeys = { ...DEFAULT_CONFIG.apiKeys, ...loaded.apiKeys };
        await saveSecureApiKeys(finalKeys);
      }

      // Keep models/modes untouched; only ensure keys are loaded
      setConfigState({ ...loaded, apiKeys: finalKeys });
    } finally {
      didLoad.current = true;
    }
  })();
}, []);

useEffect(() => {
  // Persistente Rotation: wenn SecureKeyManager wegen 429 rotiert, spiegeln wir das in config.apiKeys,
  // damit es nach App-Neustart/Backup erhalten bleibt.
  const unsubscribe = SecureKeyManager.addRotationListener((provider: AllAIProviders) => {
    // Nur persistieren, wenn Config bereits geladen ist und wir nicht gerade selbst persistieren
    if (!didLoad.current || persistRotationInProgress.current) return;

    persistRotationInProgress.current = true;
    try {
      setConfigState((prev) => {
        const list = prev.apiKeys?.[provider] ?? [];
        if (list.length < 2) return prev;
        const next = [...list.slice(1), list[0]];
        return { ...prev, apiKeys: { ...prev.apiKeys, [provider]: next } };
      });
    } finally {
      setTimeout(() => {
        persistRotationInProgress.current = false;
      }, 0);
    }
  });

  return () => {
    unsubscribe();
  };
}, []);

useEffect(() => {
  if (!didLoad.current) return;
  const redacted: AIConfig = { ...config, apiKeys: { ...DEFAULT_CONFIG.apiKeys } };
  AsyncStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(redacted)).catch(
    () => undefined,
  );
}, [config]);

useEffect(() => {
  if (!didLoad.current) return;

  // 1) In-memory keys fuer lokale Settings-/Rotations-Persistenz.
  // Produktive KI-Requests laufen seit Patch 500 ausschliesslich ueber den Edge-Proxy
  // (`invokeK1w1Handler(...)`) und lesen keine direkten Client-Provider-Keys mehr.
  (Object.keys(config.apiKeys) as AllAIProviders[]).forEach((provider) => {
    SecureKeyManager.setKeys(provider, config.apiKeys[provider] ?? []);
  });

  // 2) Persist keys securely
  saveSecureApiKeys(config.apiKeys).catch(() => undefined);
}, [config.apiKeys]);
const setConfig = useCallback((next: AIConfig) => setConfigState(next), []);
  const updateConfig = useCallback((patch: Partial<AIConfig>) => {
    setConfigState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setSelectedChatProvider = useCallback(
    (provider: AllAIProviders) =>
      updateConfig({
        selectedChatProvider: provider,
        selectedChatMode: getDefaultMode(provider, config.qualityMode) || PROVIDER_DEFAULTS[provider].speed,
      }),
    [updateConfig, config.qualityMode],
  );
  const setSelectedAgentProvider = useCallback(
    (provider: AllAIProviders) =>
      updateConfig({
        selectedAgentProvider: provider,
        selectedAgentMode: getDefaultMode(provider, config.qualityMode) || PROVIDER_DEFAULTS[provider].quality,
      }),
    [updateConfig, config.qualityMode],
  );
  const setSelectedChatMode = useCallback((mode: string) => updateConfig({ selectedChatMode: mode }), [updateConfig]);
  const setSelectedAgentMode = useCallback((mode: string) => updateConfig({ selectedAgentMode: mode }), [updateConfig]);
  const setQualityMode = useCallback((mode: QualityMode) => {
    setConfigState((prev) => {
      const nextChatMode = resolveProviderModeForQualityMode(prev.selectedChatProvider, mode);
      const nextAgentMode = resolveProviderModeForQualityMode(prev.selectedAgentProvider, mode);
      return {
        ...prev,
        qualityMode: mode,
        selectedChatMode: nextChatMode,
        selectedAgentMode: nextAgentMode,
      };
    });
  }, []);

  const setAgentEnabled = useCallback((enabled: boolean) => updateConfig({ agentEnabled: !!enabled }), [updateConfig]);

  const acknowledgeProviderStatus = useCallback((provider: AllAIProviders) => {
    setProviderStatus((prev) => prev.filter((p) => p.provider !== provider));
  }, []);

  const addApiKey = useCallback(async (provider: AllAIProviders, key: string) => {
    const k = key.trim();
    if (!k) return;
    setConfigState((prev) => {
      const current = prev.apiKeys[provider] ?? [];
      if (current.includes(k)) return prev;
      return { ...prev, apiKeys: { ...prev.apiKeys, [provider]: [...current, k] } };
    });
  }, []);

  const removeApiKey = useCallback(async (provider: AllAIProviders, key: string) => {
    setConfigState((prev) => ({
      ...prev,
      apiKeys: { ...prev.apiKeys, [provider]: (prev.apiKeys[provider] ?? []).filter((k) => k !== key) },
    }));
  }, []);

  const clearApiKeys = useCallback(async (provider: AllAIProviders) => {
    setConfigState((prev) => ({ ...prev, apiKeys: { ...prev.apiKeys, [provider]: [] } }));
  }, []);

  const rotateApiKey = useCallback(async (provider: AllAIProviders) => {
    setConfigState((prev) => {
      const keys = [...(prev.apiKeys[provider] ?? [])];
      if (keys.length <= 1) return prev;
      const first = keys.shift()!;
      keys.push(first);
      return { ...prev, apiKeys: { ...prev.apiKeys, [provider]: keys } };
    });
  }, []);

  const moveApiKeyToFront = useCallback(async (provider: AllAIProviders, keyOrIndex: string | number) => {
    setConfigState((prev) => {
      const keys = [...(prev.apiKeys[provider] ?? [])];
      if (keys.length === 0) return prev;

      let idx = -1;
      if (typeof keyOrIndex === 'number') idx = keyOrIndex;
      else idx = keys.indexOf(keyOrIndex);

      if (idx <= 0 || idx >= keys.length) return prev;
      const [k] = keys.splice(idx, 1);
      keys.unshift(k);
      return { ...prev, apiKeys: { ...prev.apiKeys, [provider]: keys } };
    });
  }, []);

  const value = useMemo(
    () => ({
      config,
      setConfig,
      updateConfig,
      addApiKey,
      removeApiKey,
      clearApiKeys,
      setSelectedChatProvider,
      setSelectedAgentProvider,
      setSelectedChatMode,
      setSelectedAgentMode,
      setQualityMode,
      setAgentEnabled,
      rotateApiKey,
      moveApiKeyToFront,
      providerStatus,
      acknowledgeProviderStatus,
    }),
    [
      config,
      setConfig,
      updateConfig,
      addApiKey,
      removeApiKey,
      clearApiKeys,
      setSelectedChatProvider,
      setSelectedAgentProvider,
      setSelectedChatMode,
      setSelectedAgentMode,
      setQualityMode,
      setAgentEnabled,
      rotateApiKey,
      moveApiKeyToFront,
      providerStatus,
      acknowledgeProviderStatus,
    ],
  );

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}

export function useAI() {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error('useAI must be used within AIProvider');
  return ctx;
}
