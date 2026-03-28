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

function asRecord(v: unknown): Record<string, unknown> | null {
  return isPlainObject(v) ? v : null;
}

function getString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function getNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function getBoolean(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function isProvider(value: unknown): value is AllAIProviders {
  return typeof value === "string" && PROVIDERS.includes(value as AllAIProviders);
}

function normalizeQualityMode(raw: unknown, fallback: AIConfig["qualityMode"]): AIConfig["qualityMode"] {
  if (raw === "speed" || raw === "balanced" || raw === "quality" || raw === "review") return raw;
  if (raw === "fast") return "speed";
  if (raw === "best") return "quality";
  return fallback;
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

  const cfg = asRecord(parsed.config);
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

  const source = asRecord(raw);
  if (!source) return base;

  const apiKeysRaw = asRecord(source.apiKeys);
  const apiKeys: AIConfig["apiKeys"] = { ...base.apiKeys };

  if (apiKeysRaw) {
    for (const p of PROVIDERS) {
      apiKeys[p] = sanitizeKeyList(apiKeysRaw[p], maxKeys);
    }
  }

  const version = getNumber(source.version) ?? base.version;

  const selectedChatProviderRaw = source.selectedChatProvider;
  const selectedAgentProviderRaw = source.selectedAgentProvider ?? source.selectedAutofixProvider;

  const selectedChatModeRaw = source.selectedChatMode;
  const selectedAgentModeRaw = source.selectedAgentMode;
  const agentEnabledRaw = source.agentEnabled;

  const qualityMode = normalizeQualityMode(source.qualityMode, base.qualityMode);

  const selectedChatProvider: AIConfig["selectedChatProvider"] =
    isProvider(selectedChatProviderRaw) ? selectedChatProviderRaw : base.selectedChatProvider;

  const selectedAgentProvider: AIConfig["selectedAgentProvider"] =
    isProvider(selectedAgentProviderRaw) ? selectedAgentProviderRaw : base.selectedAgentProvider;

  return {
    ...base,
    version,
    apiKeys,
    selectedChatProvider,
    selectedAgentProvider,
    selectedChatMode: getString(selectedChatModeRaw) ?? base.selectedChatMode,
    selectedAgentMode: getString(selectedAgentModeRaw) ?? base.selectedAgentMode,
    agentEnabled: getBoolean(agentEnabledRaw) ?? base.agentEnabled,
    qualityMode,
  };
}

export function safeFormatBackupDate(isoMaybe: unknown): string {
  if (typeof isoMaybe !== "string") return "Unbekannt";
  const d = new Date(isoMaybe);
  if (Number.isNaN(d.getTime())) return "Unbekannt";
  return d.toLocaleString("de-DE");
}
