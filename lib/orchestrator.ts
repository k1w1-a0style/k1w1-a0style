// lib/orchestrator.ts – Orchestrator mit sauberem Fallback & HuggingFace-Support
// ✅ AbortController + Timeout pro Request
// ✅ Key-Rotation via AIContext.rotateApiKeyOnError
// ✅ Hugging Face Router (router.huggingface.co) statt alter Inference-API
// ✅ Provider-Order aus Config, inkl. Fallback

import { extractJsonArray, safeJsonParse } from "../utils/chatUtils";
import { ProjectFile } from "../contexts/types";
import {
  rotateApiKeyOnError,
  detectMetaFromConfig,
  type AllAIProviders,
} from "../contexts/AIContext";
import { toAppError, logAppError } from "../utils/errorUtils";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type QualityMode = "speed" | "quality";

type OrchestratorOkResult = {
  ok: true;
  provider: AllAIProviders;
  model: string;
  quality: "speed" | "quality" | "unknown";
  text: string;
  raw: any;
  files?: ProjectFile[];
  keysRotated?: number;
  timing?: {
    startTime: number;
    endTime: number;
    durationMs: number;
  };
};

type OrchestratorErrorEntry = {
  provider: string;
  error: string;
  timestamp: string;
};

type OrchestratorErrorResult = {
  ok: false;
  errors: OrchestratorErrorEntry[];
  fatal?: boolean;
  error?: string;
};

// Provider-Reihenfolge für Fallback (Free-Tier zuerst)
const PROVIDERS: AllAIProviders[] = [
  "groq", // Free, sehr schnell
  "gemini", // Free-Tier verfügbar
  "google", // Free-Tier verfügbar (Alias von gemini)
  "huggingface", // Meist kostenlos
  "ollama", // Lokal, kostenlos
  "openai", // Paid
  "anthropic", // Paid
  "openrouter", // Paid
  "deepseek", // Paid
  "xai", // Paid
];

const TIMEOUT_BY_PROVIDER: Record<AllAIProviders, number> = {
  openai: 45000, // OpenAI braucht manchmal etwas länger
  groq: 20000,
  gemini: 30000,
  google: 30000,
  huggingface: 30000,
  ollama: 30000,
  anthropic: 30000,
  openrouter: 30000,
  deepseek: 30000,
  xai: 30000,
};

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_KEY_RETRIES = 3;

function getTimeoutMs(provider: AllAIProviders): number {
  return TIMEOUT_BY_PROVIDER[provider] ?? DEFAULT_TIMEOUT_MS;
}

// ============================================
// LOGGING
// ============================================
function log(level: "INFO" | "WARN" | "ERROR", msg: string, meta?: any) {
  const time = new Date().toISOString();
  if (meta) {
    console.log(`[Orchestrator:${level}] ${time} - ${msg}`, meta);
  } else {
    console.log(`[Orchestrator:${level}] ${time} - ${msg}`);
  }
}

// ============================================
// REQUEST POOL (verhindert parallele Requests)
// ============================================
const requestPool = new Map<string, AbortController>();

function getRequestKey(provider: AllAIProviders): string {
  return provider;
}

function abortExistingRequest(key: string) {
  const controller = requestPool.get(key);
  if (controller) {
    controller.abort();
    requestPool.delete(key);
  }
}

function registerRequest(key: string, controller: AbortController) {
  abortExistingRequest(key);
  requestPool.set(key, controller);
}

function cleanupRequest(key: string) {
  requestPool.delete(key);
}

// ============================================
// API-KEY RESOLUTION
// ============================================
function resolveApiKey(provider: AllAIProviders): string | null {
  const g = (globalThis as any) || {};

  // 1) Globale Config (__K1W1_AI_CONFIG)
  try {
    const cfg = g.__K1W1_AI_CONFIG;
    if (cfg?.apiKeys?.[provider]?.[0]) {
      const key = String(cfg.apiKeys[provider][0]);
      log("INFO", `API-Key für ${provider} aus Config geladen`, {
        keyPreview: key.slice(0, 8) + "…",
      });
      return key;
    }

    // Alias: google → gemini (Config-basiert)
    if (provider === "google" && cfg?.apiKeys?.gemini?.[0]) {
      const key = String(cfg.apiKeys.gemini[0]);
      log("INFO", "API-Key für google aus Config (Alias gemini) geladen", {
        keyPreview: key.slice(0, 8) + "…",
      });
      return key;
    }
  } catch {
    // ignore
  }

  // 2) Direkt aus globalThis
  try {
    let candidate: string | undefined;
    switch (provider) {
      case "groq":
        candidate = g.GROQ_API_KEY || g.EXPO_PUBLIC_GROQ_API_KEY;
        break;
      case "gemini":
      case "google":
        candidate =
          g.GEMINI_API_KEY || g.EXPO_PUBLIC_GEMINI_API_KEY || g.GOOGLE_API_KEY;
        break;
      case "openai":
        candidate = g.OPENAI_API_KEY || g.EXPO_PUBLIC_OPENAI_API_KEY;
        break;
      case "anthropic":
        candidate = g.ANTHROPIC_API_KEY || g.EXPO_PUBLIC_ANTHROPIC_API_KEY;
        break;
      case "huggingface":
        candidate =
          g.HUGGINGFACE_API_KEY || g.EXPO_PUBLIC_HF_API_KEY || g.HF_API_KEY;
        break;
      case "openrouter":
        candidate = g.OPENROUTER_API_KEY || g.EXPO_PUBLIC_OPENROUTER_API_KEY;
        break;
      case "deepseek":
        candidate = g.DEEPSEEK_API_KEY || g.EXPO_PUBLIC_DEEPSEEK_API_KEY;
        break;
      case "xai":
        candidate = g.XAI_API_KEY || g.EXPO_PUBLIC_XAI_API_KEY;
        break;
      case "ollama":
        // Ollama braucht keinen API-Key, aber wir geben einen Dummy zurück
        candidate = g.OLLAMA_API_KEY || "ollama-local";
        break;
      default:
        break;
    }
    if (candidate && typeof candidate === "string" && candidate.trim().length) {
      log("INFO", `API-Key für ${provider} aus globalThis geladen`, {
        keyPreview: candidate.slice(0, 8) + "…",
      });
      return candidate.trim();
    }
  } catch {
    // ignore
  }

  // 3) process.env
  const envNamesMap: Record<AllAIProviders, string[]> = {
    groq: ["GROQ_API_KEY", "EXPO_PUBLIC_GROQ_API_KEY"],
    gemini: ["GEMINI_API_KEY", "EXPO_PUBLIC_GEMINI_API_KEY"],
    google: ["GOOGLE_API_KEY", "GEMINI_API_KEY", "EXPO_PUBLIC_GEMINI_API_KEY"],
    openai: ["OPENAI_API_KEY", "EXPO_PUBLIC_OPENAI_API_KEY"],
    anthropic: ["ANTHROPIC_API_KEY", "EXPO_PUBLIC_ANTHROPIC_API_KEY"],
    huggingface: [
      "HUGGINGFACE_API_KEY",
      "EXPO_PUBLIC_HF_API_KEY",
      "HF_API_KEY",
    ],
    openrouter: ["OPENROUTER_API_KEY", "EXPO_PUBLIC_OPENROUTER_API_KEY"],
    deepseek: ["DEEPSEEK_API_KEY", "EXPO_PUBLIC_DEEPSEEK_API_KEY"],
    xai: ["XAI_API_KEY", "EXPO_PUBLIC_XAI_API_KEY"],
    ollama: ["OLLAMA_API_KEY"],
  };

  const envNames: string[] = envNamesMap[provider] || [];

  for (const name of envNames) {
    const v = (process.env as any)?.[name];
    if (typeof v === "string" && v.trim().length > 0) {
      log("INFO", `API-Key für ${provider} aus process.env geladen`, {
        envName: name,
      });
      return v.trim();
    }
  }

  const msg = `Kein API-Key für ${provider} gefunden`;
  log("ERROR", msg);
  const appError = toAppError(new Error(msg), {
    code: "ORCH_NO_API_KEY",
    meta: { provider },
  });
  logAppError(appError, "resolveApiKey");
  return null;
}

// ============================================
// ERROR-KATEGORISIERUNG
// ============================================
function shouldRotateKey(errorMsg: string): boolean {
  const lower = (errorMsg || "").toLowerCase();
  const isRotatable =
    lower.includes("rate limit") ||
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("too many requests");
  if (isRotatable) log("INFO", "Fehler ist rotierbar", { errorMsg });
  return isRotatable;
}

function enhanceErrorMessage(provider: AllAIProviders, error: string): string {
  const lower = (error || "").toLowerCase();
  const providerLabel = provider.toUpperCase();

  // HuggingFace-spezifisch
  if (lower.includes("api-inference.huggingface.co")) {
    return `${providerLabel}: Alter Endpoint – bitte neuere API verwenden.`;
  }

  // Auth-Fehler
  if (
    lower.includes("401") ||
    lower.includes("unauthorized") ||
    lower.includes("invalid_api_key") ||
    lower.includes("invalid api key")
  ) {
    return `${providerLabel}: API-Key ungültig oder abgelaufen.`;
  }
  if (lower.includes("403") || lower.includes("forbidden")) {
    return `${providerLabel}: Zugriff verweigert – Berechtigung prüfen.`;
  }

  // Rate Limits
  if (
    lower.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("quota")
  ) {
    return `${providerLabel}: Rate-Limit erreicht – Key wird rotiert.`;
  }

  // Netzwerk/Timeout
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return `${providerLabel}: Timeout – Anfrage zu lange gedauert.`;
  }
  if (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("econnrefused")
  ) {
    return `${providerLabel}: Netzwerkfehler – Verbindung prüfen.`;
  }

  // Model nicht gefunden
  if (lower.includes("model not found") || lower.includes("does not exist")) {
    return `${providerLabel}: Modell nicht verfügbar.`;
  }

  // Server-Fehler
  if (
    lower.includes("500") ||
    lower.includes("502") ||
    lower.includes("503") ||
    lower.includes("internal server")
  ) {
    return `${providerLabel}: Server-Fehler – später erneut versuchen.`;
  }

  return `${providerLabel}: ${error}`;
}

// ============================================
// HELPER: OK-RESULT
// ============================================
function buildOkResult(
  provider: AllAIProviders,
  model: string,
  text: string,
  raw: any,
  startTime: number,
): OrchestratorOkResult {
  const endTime = Date.now();
  const durationMs = endTime - startTime;
  return {
    ok: true,
    provider,
    model,
    quality: "unknown",
    text,
    raw,
    timing: { startTime, endTime, durationMs },
  };
}

// ============================================
// PROVIDER CALLS
// ============================================
function toOpenAIChatMessages(messages: LlmMessage[]) {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

async function callGroq(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  controller: AbortController,
): Promise<OrchestratorOkResult> {
  const startTime = Date.now();
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const body = {
    model,
    messages: toOpenAIChatMessages(messages),
    temperature: 0.2,
    max_tokens: 8000,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  const json: any = await res.json();
  if (!res.ok) {
    const errorMsg =
      json?.error?.message ||
      json?.error ||
      json?.message ||
      `HTTP ${res.status}`;
    throw new Error(errorMsg);
  }

  const finishReason = json?.choices?.[0]?.finish_reason;
  if (finishReason === "length") {
    log("WARN", "Groq response truncated due to max_tokens limit", {
      model,
      finishReason,
    });
  }

  const text =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.text ??
    JSON.stringify(json);
  return buildOkResult("groq", model, text, json, startTime);
}

function geminiApiVersionForModel(model: string): "v1" | "v1beta" {
  const m = model.toLowerCase();

  // Gemini 1.5 + 2.x + experimental laufen typischerweise über v1beta
  if (
    m.includes("1.5") ||
    m.includes("2.0") ||
    m.includes("2.") ||
    m.includes("exp")
  ) {
    return "v1beta";
  }

  return "v1";
}

async function callGeminiFamily(
  provider: "gemini" | "google",
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  controller: AbortController,
): Promise<OrchestratorOkResult> {
  const startTime = Date.now();
  const apiVersion = geminiApiVersionForModel(model);
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const contents = [
    {
      role: "user",
      parts: [
        {
          text: messages
            .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
            .join("\n"),
        },
      ],
    },
  ];

  const body = {
    contents,
    generationConfig: { temperature: 0.15, maxOutputTokens: 8000 },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  const json: any = await res.json();
  if (!res.ok) {
    const errorMsg = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(errorMsg);
  }

  const finishReason = json?.candidates?.[0]?.finishReason;
  if (finishReason === "MAX_TOKENS" || finishReason === "LENGTH") {
    log("WARN", "Gemini response truncated due to token limit", {
      model,
      finishReason,
    });
  }

  const text =
    json?.candidates?.[0]?.content?.parts?.[0]?.text ?? JSON.stringify(json);
  return buildOkResult(provider, model, text, json, startTime);
}

const callGemini = (
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  controller: AbortController,
) => callGeminiFamily("gemini", apiKey, model, messages, controller);

const callGoogle = (
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  controller: AbortController,
) => callGeminiFamily("google", apiKey, model, messages, controller);

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  controller: AbortController,
): Promise<OrchestratorOkResult> {
  const startTime = Date.now();
  const url = "https://api.openai.com/v1/chat/completions";
  const body = {
    model,
    messages: toOpenAIChatMessages(messages),
    temperature: 0.2,
    max_tokens: 8000,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  const json: any = await res.json();
  if (!res.ok) {
    const errorMsg =
      json?.error?.message ||
      json?.error ||
      json?.message ||
      `HTTP ${res.status}`;
    throw new Error(errorMsg);
  }

  const finishReason = json?.choices?.[0]?.finish_reason;
  if (finishReason === "length") {
    log("WARN", "OpenAI response truncated due to max_tokens limit", {
      model,
      finishReason,
    });
  }

  const text =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.text ??
    JSON.stringify(json);
  return buildOkResult("openai", model, text, json, startTime);
}

async function callAnthropic(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  controller: AbortController,
): Promise<OrchestratorOkResult> {
  const startTime = Date.now();
  const url = "https://api.anthropic.com/v1/messages";
  const systemMsg = messages.find((m) => m.role === "system");
  const userMessages = messages.filter((m) => m.role !== "system");

  const body = {
    model,
    system: systemMsg?.content,
    messages: userMessages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    temperature: 0.2,
    max_tokens: 8000,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  const json: any = await res.json();
  if (!res.ok) {
    const errorMsg =
      json?.error?.message ||
      json?.error ||
      json?.message ||
      `HTTP ${res.status}`;
    throw new Error(errorMsg);
  }

  const finishReason = json?.stop_reason;
  if (finishReason === "max_tokens") {
    log("WARN", "Anthropic response truncated due to max_tokens limit", {
      model,
      finishReason,
    });
  }

  const text =
    json?.content?.[0]?.text ??
    json?.choices?.[0]?.message?.content ??
    JSON.stringify(json);
  return buildOkResult("anthropic", model, text, json, startTime);
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  controller: AbortController,
): Promise<OrchestratorOkResult> {
  const startTime = Date.now();
  const url = "https://openrouter.ai/api/v1/chat/completions";
  const body = {
    model,
    messages: toOpenAIChatMessages(messages),
    temperature: 0.2,
    max_tokens: 8000,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  const json: any = await res.json();
  if (!res.ok) {
    const errorMsg =
      json?.error?.message ||
      json?.error ||
      json?.message ||
      `HTTP ${res.status}`;
    throw new Error(errorMsg);
  }

  const finishReason = json?.choices?.[0]?.finish_reason;
  if (finishReason === "length") {
    log("WARN", "OpenRouter response truncated due to max_tokens limit", {
      model,
      finishReason,
    });
  }

  const text =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.text ??
    JSON.stringify(json);
  return buildOkResult("openrouter", model, text, json, startTime);
}

async function callDeepSeek(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  controller: AbortController,
): Promise<OrchestratorOkResult> {
  const startTime = Date.now();
  const url = "https://api.deepseek.com/chat/completions";
  const body = {
    model,
    messages: toOpenAIChatMessages(messages),
    temperature: 0.2,
    max_tokens: 8000,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  const json: any = await res.json();
  if (!res.ok) {
    const errorMsg =
      json?.error?.message ||
      json?.error ||
      json?.message ||
      `HTTP ${res.status}`;
    throw new Error(errorMsg);
  }

  const finishReason = json?.choices?.[0]?.finish_reason;
  if (finishReason === "length") {
    log("WARN", "DeepSeek response truncated due to max_tokens limit", {
      model,
      finishReason,
    });
  }

  const text =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.text ??
    JSON.stringify(json);
  return buildOkResult("deepseek", model, text, json, startTime);
}

async function callXai(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  controller: AbortController,
): Promise<OrchestratorOkResult> {
  const startTime = Date.now();
  const url = "https://api.x.ai/v1/chat/completions";
  const body = {
    model,
    messages: toOpenAIChatMessages(messages),
    temperature: 0.2,
    max_tokens: 8000,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  const json: any = await res.json();
  if (!res.ok) {
    const errorMsg =
      json?.error?.message ||
      json?.error ||
      json?.message ||
      `HTTP ${res.status}`;
    throw new Error(errorMsg);
  }

  const finishReason = json?.choices?.[0]?.finish_reason;
  if (finishReason === "length") {
    log("WARN", "xAI response truncated due to max_tokens limit", {
      model,
      finishReason,
    });
  }

  const text =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.text ??
    JSON.stringify(json);
  return buildOkResult("xai", model, text, json, startTime);
}

/**
 * Hugging Face – Router API
 * Endpoint: https://router.huggingface.co/models/{model}
 */
async function callHuggingFace(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  controller: AbortController,
): Promise<OrchestratorOkResult> {
  const startTime = Date.now();
  const url = `https://router.huggingface.co/models/${encodeURIComponent(
    model,
  )}`;

  const prompt = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  const body = {
    inputs: prompt,
    parameters: {
      max_new_tokens: 8000,
      temperature: 0.2,
    },
    options: {
      wait_for_model: true,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  const txt = await res.text();
  let json: any = null;
  try {
    json = txt ? JSON.parse(txt) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const errorMsg =
      json?.error?.message ||
      json?.error ||
      json?.message ||
      `HTTP ${res.status}: ${txt.slice(0, 120)}`;
    throw new Error(errorMsg);
  }

  if (!json) {
    throw new Error(`hf_non_json_response: ${txt.slice(0, 120)}`);
  }

  let text = "";
  if (Array.isArray(json)) {
    if (json[0]?.generated_text) text = json[0].generated_text;
    else if (json[0]?.summary_text) text = json[0].summary_text;
    else if (json[0]?.text) text = json[0].text;
    else text = JSON.stringify(json);
  } else if (typeof json?.generated_text === "string") {
    text = json.generated_text;
  } else if (typeof json?.text === "string") {
    text = json.text;
  } else if (json?.choices?.[0]?.text) {
    text = json.choices[0].text;
  } else {
    text = JSON.stringify(json);
  }

  return buildOkResult("huggingface", model, text, json, startTime);
}

// ============================================
// RETRY-LOGIK
// ============================================
async function callProviderWithRetry(
  provider: AllAIProviders,
  model: string,
  messages: LlmMessage[],
): Promise<{ result: OrchestratorOkResult; rotations: number }> {
  let rotations = 0;
  const errors: string[] = [];
  const requestKey = getRequestKey(provider);

  for (let attempt = 0; attempt < MAX_KEY_RETRIES; attempt++) {
    const apiKey = resolveApiKey(provider);
    if (!apiKey) {
      const msg = `Kein API-Key für ${provider} gefunden`;
      const appError = toAppError(new Error(msg), {
        code: "ORCH_NO_API_KEY",
        meta: { provider, model, attempt: attempt + 1 },
      });
      logAppError(appError, "callProviderWithRetry");
      throw new Error(msg);
    }

    const controller = new AbortController();
    registerRequest(requestKey, controller);

    log(
      "INFO",
      `Call ${provider} (Versuch ${attempt + 1}/${MAX_KEY_RETRIES})`,
      {
        model,
        keyPreview: apiKey.slice(0, 8) + "…",
      },
    );

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      const callPromise = (async () => {
        switch (provider) {
          case "groq":
            return callGroq(apiKey, model, messages, controller);
          case "gemini":
            return callGemini(apiKey, model, messages, controller);
          case "google":
            return callGoogle(apiKey, model, messages, controller);
          case "openai":
            return callOpenAI(apiKey, model, messages, controller);
          case "anthropic":
            return callAnthropic(apiKey, model, messages, controller);
          case "openrouter":
            return callOpenRouter(apiKey, model, messages, controller);
          case "deepseek":
            return callDeepSeek(apiKey, model, messages, controller);
          case "xai":
            return callXai(apiKey, model, messages, controller);
          case "huggingface":
            return callHuggingFace(apiKey, model, messages, controller);
          case "ollama":
            return callOllama(apiKey, model, messages, controller);
          default:
            throw new Error(`Unbekannter Provider: ${provider}`);
        }
      })();

      const timeoutPromise = new Promise<OrchestratorOkResult>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(
            new Error(
              `Timeout nach ${getTimeoutMs(provider)}ms: ${provider}:${model}`,
            ),
          );
        }, getTimeoutMs(provider));
      });

      const result = (await Promise.race([
        callPromise,
        timeoutPromise,
      ])) as OrchestratorOkResult;

      if (timeoutId) clearTimeout(timeoutId);

      log("INFO", `✅ Erfolg mit ${provider}`, {
        model,
        rotations,
        durationMs: result.timing?.durationMs,
        textLength: result.text?.length,
      });

      cleanupRequest(requestKey);
      return { result, rotations };
    } catch (e: any) {
      if (timeoutId) clearTimeout(timeoutId);
      cleanupRequest(requestKey);

      const errorMsg = String(e?.message || e || "Unknown error");
      const enhancedMsg = enhanceErrorMessage(provider, errorMsg);
      errors.push(enhancedMsg);

      log("ERROR", "Provider-Call fehlgeschlagen", {
        provider,
        model,
        attempt: attempt + 1,
        error: errorMsg,
      });

      const appError = toAppError(e, {
        code: "ORCH_PROVIDER_CALL_FAILED",
        message: enhancedMsg,
        meta: { provider, model, attempt: attempt + 1 },
      });
      logAppError(appError, "callProviderWithRetry");

      if (shouldRotateKey(errorMsg)) {
        log("INFO", `🔄 Rotiere Key für ${provider}.`);
        const rotated = await rotateApiKeyOnError(provider);
        if (!rotated) {
          const msg = `Alle API-Keys für ${provider} erschöpft: ${enhancedMsg}`;
          const exhaustedError = toAppError(new Error(msg), {
            code: "ORCH_KEYS_EXHAUSTED",
            meta: { provider, model, attempt: attempt + 1 },
          });
          logAppError(exhaustedError, "callProviderWithRetry");
          throw new Error(msg);
        }
        rotations++;
        log("INFO", `Key rotiert (${rotations}x), nächster Versuch.`);
        continue;
      } else {
        // Nicht-rotierbarer Fehler → direkt abbrechen
        break;
      }
    }
  }

  const msgLines = [
    `Max. Versuche (${MAX_KEY_RETRIES}) erreicht für ${provider}.`,
    ...errors.map((e, i) => `Attempt ${i + 1}: ${e}`),
  ];
  const finalMsg = msgLines.join("\n");

  const appError = toAppError(new Error(finalMsg), {
    code: "ORCH_MAX_RETRIES_REACHED",
    meta: { provider, model },
  });
  logAppError(appError, "callProviderWithRetry");
  throw new Error(finalMsg);
}

// ============================================
// OLLAMA
// ============================================
async function callOllama(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  controller: AbortController,
): Promise<OrchestratorOkResult> {
  const startTime = Date.now();
  const g = (globalThis as any) || {};
  const baseUrl = g.OLLAMA_BASE_URL || "http://localhost:11434";
  const url = `${baseUrl}/api/chat`;
  const body = {
    model,
    messages: toOpenAIChatMessages(messages),
    stream: false,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: apiKey ? `Bearer ${apiKey}` : undefined,
      "Content-Type": "application/json",
    } as any,
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  const text = await res.text();
  if (!res.ok) {
    const errorMsg = text || `HTTP ${res.status}`;
    throw new Error(errorMsg);
  }

  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  let answer = "";
  if (json?.message?.content) {
    answer = json.message.content;
  } else if (Array.isArray(json?.messages)) {
    const last = json.messages[json.messages.length - 1];
    answer = last?.content ?? JSON.stringify(json);
  } else {
    answer = JSON.stringify(json);
  }

  return buildOkResult("ollama", model, answer, json, startTime);
}

// ============================================
// SEQUENTIELLER Fallback mit Config-Meta
// ============================================
async function runSequentialFallback(
  primaryProvider: AllAIProviders,
  selectedModel: string,
  qualityMode: QualityMode,
  messages: LlmMessage[],
): Promise<OrchestratorOkResult | OrchestratorErrorResult> {
  const meta = detectMetaFromConfig(
    primaryProvider,
    selectedModel,
    qualityMode,
  );
  const quality = meta.quality;

  const order: AllAIProviders[] = [...PROVIDERS];
  if (order.includes(primaryProvider)) {
    order.splice(order.indexOf(primaryProvider), 1);
    order.unshift(primaryProvider);
  }

  const errors: OrchestratorErrorEntry[] = [];

  for (const provider of order) {
    try {
      const metaForProvider = detectMetaFromConfig(
        provider,
        selectedModel,
        qualityMode,
      );
      const modelForProvider = metaForProvider.model;

      log("INFO", `🔄 Fallback zu ${provider}`, { model: modelForProvider });

      const { result, rotations } = await callProviderWithRetry(
        provider,
        modelForProvider,
        messages,
      );

      return { ...result, quality, keysRotated: rotations };
    } catch (e: any) {
      const message = e?.message || "unknown_error";
      log("WARN", `Provider ${provider} fehlgeschlagen`, { error: message });

      const appError = toAppError(e, {
        code: "ORCH_PROVIDER_FALLBACK_FAILED",
        meta: { provider, model: selectedModel, qualityMode },
      });
      logAppError(appError, "runSequentialFallback");

      errors.push({
        provider,
        error: message,
        timestamp: new Date().toISOString(),
      });

      if (message.includes("Kein API-Key")) {
        // Kein Key → nächster Provider
        continue;
      }
    }
  }

  log("ERROR", "Alle Provider fehlgeschlagen", { errorCount: errors.length });
  const appError = toAppError(
    new Error(errors[0]?.error || "Kein Provider war erfolgreich"),
    {
      code: "ORCH_ALL_PROVIDERS_FAILED",
      meta: { errorCount: errors.length },
    },
  );
  logAppError(appError, "runSequentialFallback");

  return {
    ok: false,
    errors,
    fatal: false,
    error: errors[0]?.error || "Kein Provider war erfolgreich",
  };
}

// ============================================
// PUBLIC API – Haupt-Orchestrator
// ============================================
export async function runOrchestrator(
  selectedProvider: AllAIProviders,
  selectedModel: string,
  qualityMode: QualityMode,
  messages: LlmMessage[],
): Promise<OrchestratorOkResult | OrchestratorErrorResult> {
  log("INFO", "🚀 Orchestrator gestartet", {
    provider: selectedProvider,
    model: selectedModel,
    quality: qualityMode,
    messageCount: messages.length,
  });

  // Vor neuem Lauf alle offenen Requests abbrechen
  requestPool.forEach((controller) => controller.abort());
  requestPool.clear();

  try {
    const result = await runSequentialFallback(
      selectedProvider,
      selectedModel,
      qualityMode,
      messages,
    );

    if (result.ok) {
      log("INFO", "✅ Orchestrator erfolgreich", {
        provider: result.provider,
        model: result.model,
        durationMs: result.timing?.durationMs,
      });
    } else {
      log("WARN", "⚠️ Orchestrator fehlgeschlagen", {
        errorCount: result.errors.length,
      });
    }

    return result;
  } catch (err: any) {
    log("ERROR", "❌ Fatal error in Orchestrator", { error: err?.message });

    const appError = toAppError(err, {
      code: "ORCH_FATAL",
      meta: {
        stage: "runOrchestrator",
        provider: selectedProvider,
        model: selectedModel,
      },
    });
    logAppError(appError, "runOrchestrator");

    return {
      ok: false,
      fatal: true,
      error: appError.message || "fatal_error",
      errors: [],
    };
  } finally {
    requestPool.forEach((controller) => controller.abort());
    requestPool.clear();
  }
}

// ============================================
// PUBLIC API – Validator-Orchestrator
// ============================================
export async function runValidatorOrchestrator(
  selectedAgentProvider: AllAIProviders,
  selectedAgentMode: string,
  messages: LlmMessage[],
): Promise<OrchestratorOkResult | OrchestratorErrorResult> {
  log("INFO", "🔍 Validator-Orchestrator gestartet", {
    provider: selectedAgentProvider,
    mode: selectedAgentMode,
    messageCount: messages.length,
  });

  requestPool.forEach((controller) => controller.abort());
  requestPool.clear();

  try {
    const result = await runSequentialFallback(
      selectedAgentProvider,
      selectedAgentMode,
      "quality",
      messages,
    );

    if (result.ok) {
      log("INFO", "✅ Validator-Orchestrator erfolgreich", {
        provider: result.provider,
        model: result.model,
        durationMs: result.timing?.durationMs,
      });
    } else {
      log("WARN", "⚠️ Validator-Orchestrator fehlgeschlagen", {
        errorCount: result.errors.length,
      });
    }

    return result;
  } catch (err: any) {
    log("ERROR", "❌ Fatal error in Validator", { error: err?.message });

    const appError = toAppError(err, {
      code: "ORCH_VALIDATOR_FATAL",
      meta: {
        stage: "runValidatorOrchestrator",
        provider: selectedAgentProvider,
        mode: selectedAgentMode,
      },
    });
    logAppError(appError, "runValidatorOrchestrator");

    return {
      ok: false,
      fatal: true,
      error: appError.message || "fatal_error",
      errors: [],
    };
  } finally {
    requestPool.forEach((controller) => controller.abort());
    requestPool.clear();
  }
}
