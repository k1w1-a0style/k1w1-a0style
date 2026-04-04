import type { AIConfig, AllAIProviders } from "../contexts/AIContext/models";
import { PROVIDER_DEFAULTS } from "../contexts/AIContext/models";
import { asRecord, isRecord, readBoolean, readFiniteNumber, readOptionalString, readString, readStringArray } from "./validation/recordReaders";

const PROVIDERS: AllAIProviders[] = [
  "groq",
  "gemini",
  "openai",
  "anthropic",
  "huggingface",
];
const PROVIDER_SET: ReadonlySet<AllAIProviders> = new Set(PROVIDERS);

export const BACKUP_AI_CONFIG_FALLBACK: AIConfig = {
  version: 4,
  selectedChatProvider: "groq",
  selectedChatMode: PROVIDER_DEFAULTS.groq.speed,
  selectedAgentProvider: "anthropic",
  selectedAgentMode: PROVIDER_DEFAULTS.anthropic.quality,
  qualityMode: "speed",
  agentEnabled: true,
  apiKeys: { groq: [], gemini: [], openai: [], anthropic: [], huggingface: [] },
};

type ApiBackupV1 = {
  version: 1;
  exportDate?: string;
  appVersion?: string;
  config: unknown;
};

function stripApiKeysFromConfig(raw: unknown): unknown {
  const config = asRecord(raw);
  if (!config) {
    return raw;
  }

  return {
    ...config,
    apiKeys: {
      groq: [],
      gemini: [],
      openai: [],
      anthropic: [],
      huggingface: [],
    },
  };
}

export function createApiBackupExportPayload(input: {
  config: unknown;
  exportDate?: string;
  appVersion?: string;
}): ApiBackupV1 {
  const payload: ApiBackupV1 = {
    version: 1,
    config: stripApiKeysFromConfig(input.config),
  };

  if (typeof input.exportDate === "string") {
    payload.exportDate = input.exportDate;
  }
  if (typeof input.appVersion === "string") {
    payload.appVersion = input.appVersion;
  }

  return payload;
}

function isProvider(value: unknown): value is AllAIProviders {
  return typeof value === "string" && PROVIDER_SET.has(value as AllAIProviders);
}

function normalizeQualityMode(raw: unknown, fallback: AIConfig["qualityMode"]): AIConfig["qualityMode"] {
  if (raw === "speed" || raw === "balanced" || raw === "quality" || raw === "review") return raw;
  if (raw === "fast") return "speed";
  if (raw === "best") return "quality";
  return fallback;
}

export function validateApiBackupJson(parsed: unknown): ApiBackupV1 {
  if (!isRecord(parsed)) throw new Error("Ungültiges Backup-Format");
  if (parsed.version !== 1) throw new Error("Nicht unterstützte Backup-Version");
  if (!("config" in parsed)) throw new Error("Ungültiges Backup-Format");

  const cfg = asRecord(parsed.config);
  if (!cfg) throw new Error("Ungültiges Backup-Format");

  // Minimal schema validation: apiKeys must be an object when present.
  if ("apiKeys" in cfg && cfg.apiKeys !== undefined && !isRecord(cfg.apiKeys)) {
    throw new Error("Ungültiges Backup-Format");
  }

  const validated: ApiBackupV1 = {
    version: 1,
    config: cfg,
  };
  const exportDate = readOptionalString(parsed.exportDate);
  const appVersion = readOptionalString(parsed.appVersion);
  if (exportDate) validated.exportDate = exportDate;
  if (appVersion) validated.appVersion = appVersion;
  return validated;
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
      apiKeys[p] = readStringArray(apiKeysRaw[p], maxKeys);
    }
  }

  const version = readFiniteNumber(source.version) ?? base.version;

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
    selectedChatMode: readString(selectedChatModeRaw, base.selectedChatMode),
    selectedAgentMode: readString(selectedAgentModeRaw, base.selectedAgentMode),
    agentEnabled: readBoolean(agentEnabledRaw) ?? base.agentEnabled,
    qualityMode,
  };
}

export function mergeApiConfigImportPreservingLocalKeys(raw: unknown, fallback: AIConfig): AIConfig {
  const sanitized = sanitizeAiConfigFromBackup(raw, fallback);
  return {
    ...sanitized,
    apiKeys: { ...fallback.apiKeys },
  };
}

export function safeFormatBackupDate(isoMaybe: unknown): string {
  if (typeof isoMaybe !== "string") return "Unbekannt";
  const d = new Date(isoMaybe);
  if (Number.isNaN(d.getTime())) return "Unbekannt";
  return d.toLocaleString("de-DE");
}
