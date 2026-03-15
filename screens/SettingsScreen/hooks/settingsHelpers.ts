// screens/SettingsScreen/hooks/settingsHelpers.ts
// Shared, pure helpers for SettingsScreen hook/components.

import type { ProviderLimitStatus } from "../../../contexts/AIContext";
import type { AllAIProviders } from "../../../contexts/AIContext";
import { redactSecrets, truncateWithMarker } from "../../../lib/secretRedaction";


export type ProviderId = AllAIProviders;

export type ProviderStatusView = {
  limitReached: boolean;
  status: "ok" | "missing_key" | "rate_limited";
  message?: string;
  lastRotation?: string;
};

type ProviderStatusArrayItem = Partial<ProviderLimitStatus> & {
  id?: ProviderId;
  limitReached?: boolean;
  lastRotation?: unknown;
};

type ProviderStatusInput =
  | ProviderLimitStatus[]
  | Record<string, ProviderStatusArrayItem | undefined>
  | null
  | undefined;

const FALLBACK_STATUS: ProviderStatusView = {
  limitReached: false,
  status: "ok",
  message: "",
};

function parseLastRotation(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? value : undefined;
}

export function getProviderStatusSnapshot(
  providerStatus: ProviderStatusInput,
  provider: ProviderId,
): ProviderStatusView {
  if (!providerStatus) return FALLBACK_STATUS;

  const normalize = (entry: ProviderStatusArrayItem | undefined): ProviderStatusView => {
    if (!entry) return FALLBACK_STATUS;
    const status =
      entry.status ?? (entry.limitReached ? "rate_limited" : "ok");

    return {
      ...FALLBACK_STATUS,
      message: typeof entry.message === "string" ? entry.message : "",
      status,
      limitReached: entry.limitReached ?? status === "rate_limited",
      lastRotation: parseLastRotation(entry.lastRotation),
    };
  };

  if (Array.isArray(providerStatus)) {
    const hit = providerStatus.find(
      (entry) => entry.provider === provider || (entry as ProviderStatusArrayItem).id === provider,
    ) as ProviderStatusArrayItem | undefined;
    return normalize(hit);
  }

  return normalize(providerStatus[provider]);
}


export function sanitizeSettingsError(error: unknown): string {
  const msg =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
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
  if (provider === "gemini" && !trimmed.startsWith("AIza")) {
    return 'Gemini Keys starten typischerweise mit "AIza".';
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
