import { useEffect, useMemo, useState } from "react";
import { Alert, Platform, ToastAndroid } from "react-native";

import { useAI } from "../../../contexts/AIContext";
import type { AllAIProviders, QualityMode } from "../../../contexts/AIContext";
import { useNotifications } from "../../../hooks/useNotifications";
import { loadChatHistorySettings, setChatHistoryPersistence } from "../../../lib/chatPrivacySettings";
import { redactSecrets, truncateWithMarker } from "../../../lib/secretRedaction";

type ProviderId = AllAIProviders;


function sanitizeSettingsError(error: unknown): string {
  const msg =
    error && typeof error === "object" && "message" in (error as any)
      ? String((error as any).message)
      : typeof error === "string"
        ? error
        : "Unbekannter Fehler";

  // Best-effort: remove tokens/keys if they appear in error messages.
  const redacted = redactSecrets(msg);
  return truncateWithMarker(redacted, 280, "…");
}

function validateApiKeyInput(provider: ProviderId, key: string): string | null {
  const trimmed = key.trim();
  if (!trimmed) return "Key darf nicht leer sein.";
  if (/\s/.test(trimmed)) return "Key darf keine Leerzeichen enthalten.";
  if (trimmed.length < 20) return "Key ist zu kurz (min. 20 Zeichen).";

  // Provider-aware prefix checks (best-effort).
  if (provider === "openai" && !trimmed.startsWith("sk-")) {
    return 'OpenAI Keys starten typischerweise mit "sk-".';
  }
  if (provider === "anthropic" && !trimmed.startsWith("sk-ant-")) {
    return 'Anthropic Keys starten typischerweise mit "sk-ant-".';
  }
  if (provider === "groq" && !trimmed.startsWith("gsk_")) {
    return 'Groq Keys starten typischerweise mit "gsk_".';
  }
  if (provider === "huggingface" && !trimmed.startsWith("hf_")) {
    return 'HuggingFace Tokens starten typischerweise mit "hf_".';
  }

  // Basic allowed chars (avoid obvious paste issues)
  if (!/^[A-Za-z0-9_\-\.]+$/.test(trimmed)) {
    return "Key enthält ungültige Zeichen.";
  }

  return null;
}

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

  const [persistChatHistory, setPersistChatHistory] = useState(true);
  const [retentionLimit, setRetentionLimit] = useState(200);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const s = await loadChatHistorySettings();
        if (!alive) return;
        setPersistChatHistory(!!s.persist);
        setRetentionLimit(Number.isFinite(s.retention) ? s.retention : 200);
      } catch {
        // best-effort
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleTogglePersistChat = async (v: boolean) => {
    setPersistChatHistory(v);
    try {
      await setChatHistoryPersistence(v);
      if (Platform.OS === "android") {
        ToastAndroid.show("Privacy gespeichert", ToastAndroid.SHORT);
      }
    } catch (error: any) {
      Alert.alert("Fehler", error?.message || "Konnte nicht speichern.");
    }
  };

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

    const validationError = validateApiKeyInput(selectedKeyProvider, trimmed);
    if (validationError) {
      Alert.alert("Ungültiger Key", validationError);
      return;
    }

    try {
      await addApiKey(selectedKeyProvider, trimmed);
      setNewKey("");
      Alert.alert("OK", "API Key hinzugefügt.");
    } catch (error: any) {
      Alert.alert(
        "Fehler",
        sanitizeSettingsError(error),
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
          } catch (error: any) {
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

    persistChatHistory,
    retentionLimit,
    handleTogglePersistChat,

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
