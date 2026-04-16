// screens/SettingsScreen/hooks/useSettingsScreen.ts
// REFACTORED: validators → settingsHelpers.ts

import { useEffect, useMemo, useState } from "react";
import { Alert, Platform, ToastAndroid } from "react-native";

import { PROVIDER_DEFAULTS, useAI } from "../../../contexts/AIContext";
import type { QualityMode } from "../../../contexts/AIContext";
import { useProject } from "../../../contexts/ProjectContext";
import { useNotifications } from "../../../hooks/useNotifications";
import {
  loadChatHistorySettings,
  setChatHistoryPersistence,
  setChatHistoryRetentionLimit,
} from "../../../lib/chatPrivacySettings";
import { scrubChatHistoryFromStoredProject } from "../../../infra/storage/projectPersistence";

import {
  getProviderStatusSnapshot,
  sanitizeSettingsError,
  validateApiKeyInput,
  parseRetentionLimitInput,
} from "./settingsHelpers";
import type { ProviderId } from "./settingsHelpers";

export function useSettingsScreen() {
  const { setChatRetentionLimit } = useProject();

  const {
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
    setAgentEnabled,
    providerStatus,
  } = useAI();

  const [newKey, setNewKey] = useState("");
  const [selectedKeyProvider, setSelectedKeyProvider] =
    useState<ProviderId>("groq");

  const [persistChatHistory, setPersistChatHistory] = useState(true);
  const [retentionLimit, setRetentionLimit] = useState(200);
  const [retentionInput, setRetentionInput] = useState("200");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const s = await loadChatHistorySettings();
        if (!alive) return;
        setPersistChatHistory(!!s.persist);
        const nextRetention = Number.isFinite(s.retention) ? s.retention : 200;
        setRetentionLimit(nextRetention);
        setRetentionInput(String(nextRetention));
      } catch {
        // best-effort
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleTogglePersistChat = async (v: boolean) => {
    const previous = persistChatHistory;
    setPersistChatHistory(v);
    let persistenceWritten = false;
    try {
      await setChatHistoryPersistence(v);
      persistenceWritten = true;
      if (!v) {
        await scrubChatHistoryFromStoredProject();
      }
      if (Platform.OS === "android") {
        ToastAndroid.show("Privacy gespeichert", ToastAndroid.SHORT);
      }
    } catch (error: unknown) {
      if (persistenceWritten && !v) {
        try {
          await setChatHistoryPersistence(previous);
          setPersistChatHistory(previous);
        } catch {
          // fail-safe consistency: keep UI on the last successfully persisted value.
          setPersistChatHistory(v);
        }
      } else {
        setPersistChatHistory(previous);
      }
      Alert.alert("Fehler", sanitizeSettingsError(error));
    }
  };

  const handleSaveRetentionLimit = async () => {
    const safe = parseRetentionLimitInput(retentionInput);
    if (safe === null) {
      Alert.alert("Ungültiger Wert", "Retention muss eine nicht-leere Zahl ≥ 0 sein.");
      return;
    }
    try {
      await setChatHistoryRetentionLimit(safe);
      await setChatRetentionLimit(safe);
      setRetentionLimit(safe);
      setRetentionInput(String(safe));
      if (Platform.OS === "android") {
        ToastAndroid.show("Retention gespeichert", ToastAndroid.SHORT);
      }
    } catch (error: unknown) {
      Alert.alert("Fehler", sanitizeSettingsError(error));
    }
  };

  // Notifications
  const { isInitialized, hasPermissions, requestPermissions, pushToken } =
    useNotifications();

  const apiKeys = config?.apiKeys ?? {};
  const generatorProvider =
    config?.selectedChatProvider ?? ("groq" as ProviderId);
  const agentProvider =
    config?.selectedAgentProvider ?? ("anthropic" as ProviderId);
  const selectedChatMode =
    config?.selectedChatMode ?? PROVIDER_DEFAULTS[generatorProvider].speed;
  const selectedAgentMode =
    config?.selectedAgentMode ?? PROVIDER_DEFAULTS[agentProvider].quality;
  const qualityMode: QualityMode = config?.qualityMode ?? "speed";
  const agentEnabled = !!config?.agentEnabled;

  const allKeys = apiKeys?.[selectedKeyProvider] ?? [];
  const hasMultipleKeys = allKeys.length > 1;

  const getProviderStatus = (provider: ProviderId) =>
    getProviderStatusSnapshot(providerStatus, provider);

  const limitStatus = getProviderStatus(selectedKeyProvider);

  const limitInfo = useMemo(() => {
    if (!limitStatus?.limitReached) {
      return "Alles grün – aktueller Key liefert noch freie Tokens.";
    }
    const ts = limitStatus.lastRotation
      ? new Date(limitStatus.lastRotation).toLocaleTimeString()
      : "gerade eben";
    return `Limit erreicht (Free/Quota). Automatisch rotiert um ${ts}.`;
  }, [limitStatus]);

  const handleSetQuality = (mode: QualityMode) => {
    const nextChatMode = PROVIDER_DEFAULTS[generatorProvider][
      mode === "quality" || mode === "review" ? "quality" : "speed"
    ];
    const nextAgentMode = PROVIDER_DEFAULTS[agentProvider][
      mode === "quality" || mode === "review" ? "quality" : "speed"
    ];

    setQualityMode(mode);
    setSelectedChatMode(nextChatMode);
    setSelectedAgentMode(nextAgentMode);
    Alert.alert("Quality Mode", `Quality Mode wurde gesetzt auf: ${mode}`);
  };

  const handleAddKey = async () => {
    const trimmed = newKey.trim();
    if (!trimmed) return;

    const validationError = validateApiKeyInput(selectedKeyProvider, trimmed);
    if (validationError) {
      Alert.alert("Ungültiger Key", validationError);
      return;
    }

    try {
      await addApiKey(selectedKeyProvider, trimmed);
      setNewKey("");
      Alert.alert("OK", "API Key hinzugefügt.");
    } catch (error: unknown) {
      Alert.alert(
        "Fehler",
        sanitizeSettingsError(error),
      );
    }
  };

  const handleRemoveKey = async (key: string) => {
    const remainingAfterDelete = (allKeys?.length ?? 0) - 1;
    const warnLastKey =
      remainingAfterDelete <= 0
        ? "\n\nHinweis: Das ist der letzte Key für diesen Provider."
        : "";

    Alert.alert("Key löschen", `Möchtest du diesen Key wirklich entfernen?${warnLastKey}`, [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Löschen",
        style: "destructive",
        onPress: async () => {
          try {
            await removeApiKey(selectedKeyProvider, key);
          } catch (error: unknown) {
            Alert.alert(
              "Fehler",
              sanitizeSettingsError(error),
            );
          }
        },
      },
    ]);
  };

  const handleRotateKey = async () => {
    if (!hasMultipleKeys) {
      Alert.alert("Rotation", "Du brauchst mindestens 2 Keys für Rotation.");
      return;
    }

    Alert.alert("Key Rotation", "Soll der nächste Key aktiviert werden?", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Rotieren",
        onPress: async () => {
          try {
            await rotateApiKey(selectedKeyProvider);
          } catch (error: unknown) {
            Alert.alert(
              "Fehler",
              sanitizeSettingsError(error),
            );
          }
        },
      },
    ]);
  };

  const handleMoveKeyToFront = async (key: string, index: number) => {
    try {
      await moveApiKeyToFront(selectedKeyProvider, key);
    } catch {
      try {
        await moveApiKeyToFront(selectedKeyProvider, index);
      } catch (error: unknown) {
        Alert.alert(
          "Fehler",
          sanitizeSettingsError(error),
        );
      }
    }
  };

  return {
    config,
    setSelectedChatProvider,
    setSelectedChatMode,
    setSelectedAgentProvider,
    setSelectedAgentMode,
    setAgentEnabled,

    newKey,
    setNewKey,
    selectedKeyProvider,
    setSelectedKeyProvider,

    persistChatHistory,
    retentionLimit,
    retentionInput,
    setRetentionInput,
    handleTogglePersistChat,
    handleSaveRetentionLimit,

    isInitialized,
    hasPermissions,
    requestPermissions,
    pushToken,

    apiKeys,
    generatorProvider,
    agentProvider,
    selectedChatMode,
    selectedAgentMode,
    qualityMode,
    agentEnabled,
    allKeys,
    hasMultipleKeys,

    getProviderStatus,
    limitStatus,
    limitInfo,

    handleSetQuality,
    handleAddKey,
    handleRemoveKey,
    handleRotateKey,
    handleMoveKeyToFront,
  };
}
