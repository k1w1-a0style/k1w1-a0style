import { useMemo, useState } from "react";
import { Alert } from "react-native";

import { useAI } from "../../../contexts/AIContext";
import type { AllAIProviders, QualityMode } from "../../../contexts/AIContext";
import { useNotifications } from "../../../hooks/useNotifications";

type ProviderId = AllAIProviders;

export function useSettingsScreen() {
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

  // Notifications
  const { isInitialized, hasPermissions, requestPermissions, pushToken } =
    useNotifications();

  // Bulletproof falls config/apiKeys mal kurz kaputt wären
  const apiKeys = (config as any)?.apiKeys ?? {};
  const generatorProvider = ((config as any)?.selectedChatProvider ??
    "groq") as ProviderId;
  const agentProvider = ((config as any)?.selectedAgentProvider ??
    "anthropic") as ProviderId;
  const selectedChatMode = (config as any)?.selectedChatMode ?? "auto";
  const selectedAgentMode = (config as any)?.selectedAgentMode ?? "auto";
  const qualityMode = ((config as any)?.qualityMode ?? "speed") as QualityMode;
  const agentEnabled = !!(config as any)?.agentEnabled;

  const allKeys = (apiKeys?.[selectedKeyProvider] ?? []) as string[];
  const hasMultipleKeys = allKeys.length > 1;

  // Robust: providerStatus can be Record<provider, status> OR an array of entries
  const getProviderStatus = (provider: ProviderId) => {
    const ps: any = providerStatus as any;
    const fallback = {
      limitReached: false,
      status: "ok",
      message: "",
      lastRotation: undefined as any,
    };

    if (!ps) return fallback;

    if (Array.isArray(ps)) {
      const hit = ps.find(
        (x: any) => x?.provider === provider || x?.id === provider,
      );
      if (!hit) return fallback;
      const status = hit.status ?? (hit.limitReached ? "rate_limited" : "ok");
      return {
        ...fallback,
        ...hit,
        status,
        limitReached: hit.limitReached ?? status === "rate_limited",
      };
    }

    if (typeof ps === "object") {
      const hit = ps[provider];
      if (!hit) return fallback;
      const status = hit.status ?? (hit.limitReached ? "rate_limited" : "ok");
      return {
        ...fallback,
        ...hit,
        status,
        limitReached: hit.limitReached ?? status === "rate_limited",
      };
    }

    return fallback;
  };

  const limitStatus = getProviderStatus(selectedKeyProvider);

  const limitInfo = useMemo(() => {
    if (!limitStatus?.limitReached) {
      return "Alles grün – aktueller Key liefert noch freie Tokens.";
    }
    const ts = (limitStatus as any).lastRotation
      ? new Date((limitStatus as any).lastRotation).toLocaleTimeString()
      : "gerade eben";
    return `Limit erreicht (Free/Quota). Automatisch rotiert um ${ts}.`;
  }, [limitStatus]);

  const handleSetQuality = (mode: QualityMode) => {
    setQualityMode(mode);
    Alert.alert("Quality Mode", `Quality Mode wurde gesetzt auf: ${mode}`);
  };

  const handleAddKey = async () => {
    const trimmed = newKey.trim();
    if (!trimmed) return;

    try {
      await addApiKey(selectedKeyProvider, trimmed);
      setNewKey("");
      Alert.alert("OK", "API Key hinzugefügt.");
    } catch (error: any) {
      Alert.alert(
        "Fehler",
        error?.message || "Key konnte nicht hinzugefügt werden.",
      );
    }
  };

  const handleRemoveKey = async (key: string) => {
    Alert.alert("Key löschen", "Möchtest du diesen Key wirklich entfernen?", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Löschen",
        style: "destructive",
        onPress: async () => {
          try {
            await removeApiKey(selectedKeyProvider, key);
          } catch (error: any) {
            Alert.alert(
              "Fehler",
              error?.message || "Key konnte nicht entfernt werden.",
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
          } catch (error: any) {
            Alert.alert(
              "Fehler",
              error?.message || "Rotation fehlgeschlagen.",
            );
          }
        },
      },
    ]);
  };

  const handleMoveKeyToFront = async (key: string, index: number) => {
    try {
      await moveApiKeyToFront(selectedKeyProvider, key);
      return;
    } catch {}
    try {
      await moveApiKeyToFront(selectedKeyProvider, index);
    } catch (error: any) {
      Alert.alert(
        "Fehler",
        error?.message || "Konnte Key nicht aktiv setzen.",
      );
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
