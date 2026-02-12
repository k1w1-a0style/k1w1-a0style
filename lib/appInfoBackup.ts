import type { AIConfig, AllAIProviders } from "../contexts/AIContext";

const PROVIDERS: AllAIProviders[] = [
  "groq",
  "gemini",
  "openai",
  "anthropic",
  "huggingface",
];

type ApiBackupV1 = {
  version: 1;
  exportDate?: string;
  appVersion?: string;
  config: unknown;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function sanitizeKeyList(v: unknown, maxKeys: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of v) {
    if (typeof raw !== "string") continue;
    const k = raw.trim();
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= maxKeys) break;
  }
  return out;
}

export function validateApiBackupJson(parsed: unknown): ApiBackupV1 {
  if (!isPlainObject(parsed)) throw new Error("Ungültiges Backup-Format");
  if (parsed.version !== 1) throw new Error("Nicht unterstützte Backup-Version");
  if (!("config" in parsed)) throw new Error("Ungültiges Backup-Format");

  const cfg = (parsed as any).config;
  if (!isPlainObject(cfg)) throw new Error("Ungültiges Backup-Format");

  // Minimal schema validation: apiKeys must be an object when present.
  if ("apiKeys" in cfg && cfg.apiKeys !== undefined && !isPlainObject(cfg.apiKeys)) {
    throw new Error("Ungültiges Backup-Format");
  }

  return parsed as ApiBackupV1;
}

export function sanitizeAiConfigFromBackup(
  raw: unknown,
  fallback: AIConfig,
  opts?: { maxKeysPerProvider?: number },
): AIConfig {
  const maxKeys = opts?.maxKeysPerProvider ?? 10;
  const base: AIConfig = { ...fallback, apiKeys: { ...fallback.apiKeys } };

  if (!isPlainObject(raw)) return base;

  const apiKeysRaw = (raw as any).apiKeys;
  const apiKeys: AIConfig["apiKeys"] = { ...base.apiKeys };

  if (isPlainObject(apiKeysRaw)) {
    for (const p of PROVIDERS) {
      apiKeys[p] = sanitizeKeyList((apiKeysRaw as any)[p], maxKeys);
    }
  }

  const version = typeof (raw as any).version === "number" ? (raw as any).version : base.version;

  const selectedChatProviderRaw = (raw as any).selectedChatProvider;
  const selectedAgentProviderRaw = (raw as any).selectedAgentProvider ?? (raw as any).selectedAutofixProvider;

  const selectedChatModeRaw = (raw as any).selectedChatMode;
  const selectedAgentModeRaw = (raw as any).selectedAgentMode;
  const agentEnabledRaw = (raw as any).agentEnabled;

  const qualityRaw = (raw as any).qualityMode;
  const qualityMode: AIConfig["qualityMode"] =
    qualityRaw === "speed" || qualityRaw === "balanced" || qualityRaw === "quality" || qualityRaw === "review"
      ? qualityRaw
      : qualityRaw === "fast"
        ? "speed"
        : qualityRaw === "best"
          ? "quality"
          : base.qualityMode;

  const selectedChatProvider: AIConfig["selectedChatProvider"] =
    typeof selectedChatProviderRaw === "string" && (PROVIDERS as string[]).includes(selectedChatProviderRaw)
      ? (selectedChatProviderRaw as AllAIProviders)
      : base.selectedChatProvider;

  const selectedAgentProvider: AIConfig["selectedAgentProvider"] =
    typeof selectedAgentProviderRaw === "string" && (PROVIDERS as string[]).includes(selectedAgentProviderRaw)
      ? (selectedAgentProviderRaw as AllAIProviders)
      : base.selectedAgentProvider;

  return {
    ...base,
    version,
    apiKeys,
    selectedChatProvider,
    selectedAgentProvider,
    selectedChatMode: typeof selectedChatModeRaw === "string" ? selectedChatModeRaw : base.selectedChatMode,
    selectedAgentMode: typeof selectedAgentModeRaw === "string" ? selectedAgentModeRaw : base.selectedAgentMode,
    agentEnabled: typeof agentEnabledRaw === "boolean" ? agentEnabledRaw : base.agentEnabled,
    qualityMode,
  };
}

export function safeFormatBackupDate(isoMaybe: unknown): string {
  if (typeof isoMaybe !== "string") return "Unbekannt";
  const d = new Date(isoMaybe);
  if (Number.isNaN(d.getTime())) return "Unbekannt";
  return d.toLocaleString("de-DE");
}
