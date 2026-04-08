import { assertRuntimeModelSupported } from "../../../../shared/ai/modelRuntimeMap.ts";
import type { ChatMessage, HandlerRequestBody, Role } from "./types.ts";

function asRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object") return null;
  return input as Record<string, unknown>;
}

const SUPPORTED_PROVIDERS = new Set<HandlerRequestBody["provider"]>([
  "groq",
  "gemini",
  "openai",
  "anthropic",
  "huggingface",
]);

const SUPPORTED_MESSAGE_ROLES = new Set<Role>(["system", "user", "assistant"]);
const MAX_MESSAGES = 64;
const MAX_MESSAGE_CONTENT_LENGTH = 20_000;
const MAX_MODEL_LENGTH = 120;
const MAX_MODE_LENGTH = 40;

function failInvalidRequest(reason: string): never {
  throw new Error(`Invalid request body: ${reason}`);
}

export function resolveProviderModelForRuntime(
  provider: "groq" | "gemini" | "openai" | "anthropic" | "huggingface",
  selectedModel: string,
): { visibleModel: string; runtimeModel: string; runtimeNote?: string } {
  const resolved = assertRuntimeModelSupported(provider, selectedModel);
  const runtimeNote = resolved.status === "mapped"
    ? `ℹ️ Runtime-Mapping aktiv: ${provider}/${resolved.visibleModel} -> ${provider}/${resolved.runtimeModel} (${resolved.note ?? "alias"}).`
    : undefined;
  return {
    visibleModel: resolved.visibleModel,
    runtimeModel: resolved.runtimeModel,
    runtimeNote,
  };
}

export function parseRequestBody(body: unknown): HandlerRequestBody {
  const record = asRecord(body);
  if (!record) {
    failInvalidRequest("body must be an object");
  }

  if (typeof record.provider !== "string") {
    failInvalidRequest("provider must be a string");
  }

  const provider = record.provider.trim().toLowerCase();
  if (!provider) {
    failInvalidRequest("provider must be a non-empty string");
  }
  if (!SUPPORTED_PROVIDERS.has(provider as HandlerRequestBody["provider"])) {
    throw new Error(`Unsupported provider: ${provider || "unknown"}`);
  }

  if (!Array.isArray(record.messages)) {
    failInvalidRequest("messages must be an array");
  }
  if (record.messages.length === 0 || record.messages.length > MAX_MESSAGES) {
    failInvalidRequest(`messages must contain between 1 and ${MAX_MESSAGES} items`);
  }

  const messages = record.messages.map((entry, index) => {
    const message = asRecord(entry);
    if (!message) {
      failInvalidRequest(`messages[${index}] must be an object`);
    }
    const role = typeof message.role === "string" ? message.role.trim().toLowerCase() : "";
    if (!SUPPORTED_MESSAGE_ROLES.has(role as Role)) {
      failInvalidRequest(`messages[${index}].role is invalid`);
    }
    const content = typeof message.content === "string" ? message.content.trim() : "";
    if (!content) {
      failInvalidRequest(`messages[${index}].content must be a non-empty string`);
    }
    if (content.length > MAX_MESSAGE_CONTENT_LENGTH) {
      failInvalidRequest(`messages[${index}].content exceeds ${MAX_MESSAGE_CONTENT_LENGTH} characters`);
    }
    return { role: role as Role, content };
  });

  const qualityRaw = typeof record.quality === "string" ? record.quality.trim() : "speed";
  if (!qualityRaw || !["speed", "balanced", "quality", "review"].includes(qualityRaw)) {
    failInvalidRequest("quality must be one of speed|balanced|quality|review");
  }
  const quality = qualityRaw as HandlerRequestBody["quality"];

  const mode = typeof record.mode === "string" ? record.mode.trim() : "builder";
  if (!mode || mode.length > MAX_MODE_LENGTH) {
    failInvalidRequest(`mode must be a non-empty string up to ${MAX_MODE_LENGTH} characters`);
  }

  const modelRaw = typeof record.model === "string" ? record.model.trim() : "";
  if (typeof record.model !== "undefined" && !modelRaw) {
    failInvalidRequest("model must be a non-empty string when provided");
  }
  if (modelRaw.length > MAX_MODEL_LENGTH) {
    failInvalidRequest(`model exceeds ${MAX_MODEL_LENGTH} characters`);
  }

  return {
    provider: provider as HandlerRequestBody["provider"],
    messages,
    mode,
    model: modelRaw || undefined,
    quality,
  };
}

export function toGeminiContents(messages: ChatMessage[]) {
  return messages.map((m) => ({
    role:
      m.role === "assistant" ? "model" : m.role === "user" ? "user" : "user",
    parts: [{ text: m.content }],
  }));
}

export function joinSystemMessages(messages: ChatMessage[]): string {
  return messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n")
    .trim();
}

export function resolveDefaultModelForQuality<T extends { speed: string; quality: string }>(
  defaults: T,
  quality: HandlerRequestBody["quality"],
): string {
  return quality === "quality" || quality === "review" ? defaults.quality : defaults.speed;
}

export function toPlainPrompt(messages: ChatMessage[]): string {
  return messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");
}
