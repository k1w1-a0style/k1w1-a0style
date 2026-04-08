import { SHARED_PROVIDER_DEFAULTS } from "../../../../shared/ai/providerDefaults.ts";

export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface HandlerRequestBody {
  provider: "groq" | "gemini" | "openai" | "anthropic" | "huggingface";
  messages: ChatMessage[];
  mode?: string;
  model?: string;
  quality?: "speed" | "balanced" | "quality" | "review";
}

export const DEFAULT_MODELS = SHARED_PROVIDER_DEFAULTS;

export const PROVIDER_UPSTREAM_TIMEOUT_MS = 45_000;
