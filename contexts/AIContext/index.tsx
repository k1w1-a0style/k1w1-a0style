// contexts/AIContext/index.tsx
// REFACTORED: models + types → models.ts, helpers → helpers.ts

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AIConfig, AIContextProps, AllAIProviders, ProviderLimitStatus, QualityMode } from "./models";
import {
  CONFIG_STORAGE_KEY, DEFAULT_CONFIG,
  loadConfig, loadSecureApiKeys, saveSecureApiKeys,
  normalizeApiKeys,
  resolveProviderModeForQualityMode,
  resolveRehydratedApiKeys,
  buildProviderSelectionPatch,
} from "./helpers";

// Re-export types & constants so existing imports from "AIContext" keep working
export type {
  AllAIProviders, QualityMode, ModelTier, ProviderLimitStatus,
  ModelInfo, ProviderDefaults, ProviderMetadata, AIConfig, AIContextProps,
} from "./models";
export { PROVIDER_DEFAULTS, PROVIDER_METADATA, AVAILABLE_MODELS } from "./models";

const AIContext = createContext<AIContextProps | undefined>(undefined);
const CONFIG_PERSIST_DEBOUNCE_MS = 350;

export function AIProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfigState] = useState<AIConfig>(DEFAULT_CONFIG);
  const [providerStatus, setProviderStatus] = useState<ProviderLimitStatus[]>([]);
  const [secureApiKeysReadable, setSecureApiKeysReadable] = useState(true);
  const didLoad = useRef(false);
  const persistConfigTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const loaded = (await loadConfig()) ?? DEFAULT_CONFIG;

        // Load keys from SecureStore (authoritative)
        const secureResult = await loadSecureApiKeys();
        if (secureResult.state === "unreadable") {
          setSecureApiKeysReadable(false);
          console.error("[AIContext] SecureStore read for ai_api_keys_v1 failed.", secureResult.error);
        } else {
          setSecureApiKeysReadable(true);
        }
        const { finalKeys, shouldMigrateLegacyToSecure } = resolveRehydratedApiKeys({
          loadedApiKeys: loaded.apiKeys,
          secureApiKeys: secureResult.keys,
        });
        if (secureResult.state !== "unreadable" && shouldMigrateLegacyToSecure) {
          await saveSecureApiKeys(finalKeys);
        }

        // Keep models/modes untouched; only ensure keys are loaded
        const nextApiKeys = secureResult.state === "unreadable"
          ? normalizeApiKeys(undefined)
          : finalKeys;
        setConfigState({ ...loaded, apiKeys: nextApiKeys });
      } finally {
        didLoad.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (!didLoad.current) return;
    const redacted: AIConfig = { ...config, apiKeys: { ...DEFAULT_CONFIG.apiKeys } };

    if (persistConfigTimeoutRef.current) {
      clearTimeout(persistConfigTimeoutRef.current);
    }

    persistConfigTimeoutRef.current = setTimeout(() => {
      AsyncStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(redacted)).catch(
        () => undefined,
      );
      persistConfigTimeoutRef.current = null;
    }, CONFIG_PERSIST_DEBOUNCE_MS);

    return () => {
      if (persistConfigTimeoutRef.current) {
        clearTimeout(persistConfigTimeoutRef.current);
        persistConfigTimeoutRef.current = null;
      }
    };
  }, [config]);

  useEffect(() => {
    if (!didLoad.current) return;
    if (!secureApiKeysReadable) return;

    // Produktive KI-Requests laufen seit Patch 500 ausschliesslich ueber den Edge-Proxy
    // (`invokeK1w1Handler(...)`). Die API-Keys bleiben deshalb nur im AIContext-State
    // und im SecureStore-Persistenzpfad; wir spiegeln sie nicht mehr in Legacy-In-Memory-Manager.
    saveSecureApiKeys(config.apiKeys).catch((error) => {
      console.error("[AIContext] SecureStore write for ai_api_keys_v1 failed.", error);
    });
  }, [config.apiKeys, secureApiKeysReadable]);

  useEffect(() => () => {
    if (persistConfigTimeoutRef.current) {
      clearTimeout(persistConfigTimeoutRef.current);
      persistConfigTimeoutRef.current = null;
    }
  }, []);

  const setConfig = useCallback((next: AIConfig) => setConfigState(next), []);
  const updateConfig = useCallback((patch: Partial<AIConfig>) => {
    setConfigState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setSelectedChatProvider = useCallback(
    (provider: AllAIProviders) =>
      updateConfig(
        buildProviderSelectionPatch({
          providerType: "chat",
          provider,
          qualityMode: config.qualityMode,
        }),
      ),
    [updateConfig, config.qualityMode],
  );
  const setSelectedAgentProvider = useCallback(
    (provider: AllAIProviders) =>
      updateConfig(
        buildProviderSelectionPatch({
          providerType: "agent",
          provider,
          qualityMode: config.qualityMode,
        }),
      ),
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

  const assertSecureStoreWritable = useCallback(() => {
    if (secureApiKeysReadable) return;
    throw new Error("API-Keys können nicht geändert werden, weil SecureStore nicht lesbar ist.");
  }, [secureApiKeysReadable]);

  const addApiKey = useCallback(async (provider: AllAIProviders, key: string) => {
    assertSecureStoreWritable();
    const k = key.trim();
    if (!k) return;
    setConfigState((prev) => {
      const current = prev.apiKeys[provider] ?? [];
      if (current.includes(k)) return prev;
      return { ...prev, apiKeys: { ...prev.apiKeys, [provider]: [...current, k] } };
    });
  }, [assertSecureStoreWritable]);

  const removeApiKey = useCallback(async (provider: AllAIProviders, key: string) => {
    assertSecureStoreWritable();
    setConfigState((prev) => ({
      ...prev,
      apiKeys: { ...prev.apiKeys, [provider]: (prev.apiKeys[provider] ?? []).filter((k) => k !== key) },
    }));
  }, [assertSecureStoreWritable]);

  const clearApiKeys = useCallback(async (provider: AllAIProviders) => {
    assertSecureStoreWritable();
    setConfigState((prev) => ({ ...prev, apiKeys: { ...prev.apiKeys, [provider]: [] } }));
  }, [assertSecureStoreWritable]);

  const rotateApiKey = useCallback(async (provider: AllAIProviders) => {
    assertSecureStoreWritable();
    setConfigState((prev) => {
      const keys = [...(prev.apiKeys[provider] ?? [])];
      if (keys.length <= 1) return prev;
      const first = keys.shift()!;
      keys.push(first);
      return { ...prev, apiKeys: { ...prev.apiKeys, [provider]: keys } };
    });
  }, [assertSecureStoreWritable]);

  const moveApiKeyToFront = useCallback(async (provider: AllAIProviders, keyOrIndex: string | number) => {
    assertSecureStoreWritable();
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
  }, [assertSecureStoreWritable]);

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
