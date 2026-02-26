// screens/SettingsScreen/hooks/settingsHelpers.ts
// Extracted from useSettingsScreen.ts: validators and helpers.

import { useEffect, useMemo, useState } from "react";
import { Alert, Platform, ToastAndroid } from "react-native";

import { PROVIDER_DEFAULTS, useAI } from "../../../contexts/AIContext";
import type { AllAIProviders, QualityMode } from "../../../contexts/AIContext";
import { useNotifications } from "../../../hooks/useNotifications";
import { loadChatHistorySettings, setChatHistoryPersistence } from "../../../lib/chatPrivacySettings";
import { redactSecrets, truncateWithMarker } from "../../../lib/secretRedaction";


export type ProviderId = AllAIProviders;


export function sanitizeSettingsError(error: unknown): string {
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

export function validateApiKeyInput(provider: ProviderId, key: string): string | null {
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

