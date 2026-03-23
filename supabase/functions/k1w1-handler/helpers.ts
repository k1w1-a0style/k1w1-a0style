// supabase/functions/k1w1-handler/helpers.ts
// Extracted from index.ts

// supabase/functions/k1w1-handler/index.ts
// Zentraler KI-Handler für k1w1-a0style.
// - Nimmt OpenAI-Style messages entgegen
// - Ruft je nach provider Groq oder Gemini auf
// - Verwendet NUR Server-Env-Keys (GROQ_API_KEY, GEMINI_API_KEY)
// - Kein API-Key mehr im Request-Body nötig.

export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface HandlerRequestBody {
  provider: "groq" | "gemini" | "openai" | "anthropic" | "huggingface" | string;
  messages: ChatMessage[];
  mode?: string;
  model?: string;
  quality?: "speed" | "quality";
}

export { corsHeadersForRequest, handleCors } from "../_shared/cors.ts";
export { requireAdminKey, rateLimit } from "../_shared/auth.ts";
export { parseJsonBody } from "../_shared/validation.ts";
import { getRuntimeEnv } from "../_shared/auth.ts";

export const DEFAULT_MODELS = {
  groq: {
    speed: "groq/compound-mini",
    quality: "llama-3.3-70b-versatile",
  },
  gemini: {
    speed: "gemini-2.5-flash-lite",
    quality: "gemini-2.5-flash",
  },
  openai: {
    speed: "gpt-4o-mini",
    quality: "gpt-4o",
  },
  anthropic: {
    speed: "claude-3-5-haiku-20241022",
    quality: "claude-3-5-sonnet-20241022",
  },
  huggingface: {
    speed: "Qwen/Qwen2.5-7B-Instruct",
    quality: "Qwen/Qwen2.5-Coder-32B-Instruct",
  },
} as const;

// ----------------- Helpers -----------------

export function parseRequestBody(body: unknown): HandlerRequestBody {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body");
  }
  const b = body as any;

  if (!b.provider || typeof b.provider !== "string") {
    throw new Error("Missing provider");
  }
  if (!b.messages || !Array.isArray(b.messages)) {
    throw new Error("Missing messages");
  }

  const provider = b.provider as string;
  const quality = (
    b.quality === "quality" || b.quality === "speed" ? b.quality : "speed"
  ) as "speed" | "quality";

  return {
    provider,
    messages: b.messages as ChatMessage[],
    mode: typeof b.mode === "string" ? b.mode : "builder",
    model: typeof b.model === "string" ? b.model : undefined,
    quality,
  };
}

export function toGeminiContents(messages: ChatMessage[]) {
  // OpenAI → Gemini Mapping
  return messages.map((m) => ({
    role:
      m.role === "assistant" ? "model" : m.role === "user" ? "user" : "user",
    parts: [{ text: m.content }],
  }));
}

function joinSystemMessages(messages: ChatMessage[]): string {
  return messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n")
    .trim();
}

export type K1w1HandlerErrorCode =
  | "provider_env_missing"
  | "provider_http_401"
  | "provider_http_403"
  | "provider_http_404"
  | "provider_http_429"
  | "provider_model_not_found"
  | "provider_upstream_error"
  | "invalid_request_payload"
  | "unsupported_provider"
  | "unknown_internal_error";

export interface K1w1HandlerErrorPayload {
  ok: false;
  code: K1w1HandlerErrorCode;
  error: string;
  provider?: string;
  model?: string;
  status: number;
}

const PROVIDER_HTTP_ERROR_PATTERN =
  /^(?<provider>[a-z0-9_-]+)_http_(?<status>\d{3}) \(model=(?<model>[^)]+)\):(?<body>[\s\S]*)$/i;

function providerHttpError(
  provider: string,
  model: string,
  status: number,
  bodyText: string,
): Error {
  return new Error(`${provider}_http_${status} (model=${model}): ${bodyText}`);
}

function normalizeProviderName(provider: string | undefined): string | undefined {
  const trimmed = typeof provider === "string" ? provider.trim().toLowerCase() : "";
  return trimmed || undefined;
}

function providerLabel(provider: string | undefined): string {
  const normalized = normalizeProviderName(provider) ?? "provider";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function safeModelLabel(model: string | undefined): string | undefined {
  if (typeof model !== "string") return undefined;
  const trimmed = model.trim();
  return trimmed ? trimmed.slice(0, 120) : undefined;
}

function parseProviderHttpErrorMessage(message: string): {
  provider?: string;
  model?: string;
  status?: number;
  upstreamBody?: string;
} {
  const match = message.match(PROVIDER_HTTP_ERROR_PATTERN);
  if (!match?.groups) return {};

  const status = Number(match.groups.status);
  return {
    provider: normalizeProviderName(match.groups.provider),
    model: safeModelLabel(match.groups.model),
    status: Number.isFinite(status) ? status : undefined,
    upstreamBody: match.groups.body?.trim(),
  };
}

function looksLikeModelMissing(upstreamBody: string | undefined): boolean {
  const text = (upstreamBody ?? "").toLowerCase();
  return (
    text.includes("model") ||
    text.includes("not found") ||
    text.includes("does not exist") ||
    text.includes("unknown model") ||
    text.includes("unsupported model")
  );
}

function buildClientErrorPayload(
  code: K1w1HandlerErrorCode,
  status: number,
  provider?: string,
  model?: string,
): K1w1HandlerErrorPayload {
  const normalizedProvider = normalizeProviderName(provider);
  const safeModel = safeModelLabel(model);
  const label = providerLabel(normalizedProvider);

  let error = "Interner Fehler im KI-Handler.";
  if (code === "provider_env_missing") {
    error = `${label} ist serverseitig nicht konfiguriert.`;
  } else if (code === "provider_http_401") {
    error = `${label} lehnt den Server-Request ab (401). Bitte Provider-Key oder Account-Berechtigungen pruefen.`;
  } else if (code === "provider_http_403") {
    error = `${label} verweigert den Zugriff auf den angeforderten KI-Request (403).`;
  } else if (code === "provider_http_404") {
    error = `${label} konnte die angeforderte Ressource nicht finden (404).`;
  } else if (code === "provider_http_429") {
    error = `${label} meldet ein Rate-Limit oder ist voruebergehend ueberlastet (429).`;
  } else if (code === "provider_model_not_found") {
    error = safeModel
      ? `Das Modell "${safeModel}" ist bei ${label} nicht verfuegbar oder wird dort nicht unterstuetzt.`
      : `${label} meldet, dass das angeforderte Modell nicht verfuegbar ist.`;
  } else if (code === "provider_upstream_error") {
    error = `${label} hat den KI-Request serverseitig nicht erfolgreich verarbeitet.`;
  } else if (code === "invalid_request_payload") {
    error = "Invalid request payload.";
  } else if (code === "unsupported_provider") {
    error = normalizedProvider
      ? `Der Provider "${normalizedProvider}" wird vom k1w1-handler nicht unterstuetzt.`
      : "Der angeforderte KI-Provider wird vom k1w1-handler nicht unterstuetzt.";
  } else if (code === "unknown_internal_error") {
    error = "Internal Server Error";
  }

  return {
    ok: false,
    code,
    error,
    ...(normalizedProvider ? { provider: normalizedProvider } : {}),
    ...(safeModel ? { model: safeModel } : {}),
    status,
  };
}

export function classifyK1w1HandlerError(
  err: unknown,
  fallback?: { provider?: string; model?: string },
): K1w1HandlerErrorPayload {
  const rawMessage = err instanceof Error ? err.message : String(err ?? "");
  const fallbackProvider = normalizeProviderName(fallback?.provider);
  const fallbackModel = safeModelLabel(fallback?.model);

  if (
    rawMessage.includes("Missing provider") ||
    rawMessage.includes("Missing messages") ||
    rawMessage.includes("Invalid request body") ||
    rawMessage.includes("body must be") ||
    rawMessage.includes("request body")
  ) {
    return buildClientErrorPayload(
      "invalid_request_payload",
      400,
      fallbackProvider,
      fallbackModel,
    );
  }

  const unsupportedMatch = rawMessage.match(/^Unsupported provider:\s*(.+)$/i);
  if (unsupportedMatch) {
    return buildClientErrorPayload(
      "unsupported_provider",
      400,
      normalizeProviderName(unsupportedMatch[1]) ?? fallbackProvider,
      fallbackModel,
    );
  }

  const envMatch = rawMessage.match(/^(?<env>[A-Z0-9_]+)_API_KEY not set in Edge env$/);
  if (envMatch?.groups?.env) {
    return buildClientErrorPayload(
      "provider_env_missing",
      500,
      normalizeProviderName(envMatch.groups.env.replace(/_API_KEY$/, "")) ?? fallbackProvider,
      fallbackModel,
    );
  }

  const providerHttp = parseProviderHttpErrorMessage(rawMessage);
  if (providerHttp.status) {
    const provider = providerHttp.provider ?? fallbackProvider;
    const model = providerHttp.model ?? fallbackModel;
    if (providerHttp.status === 401) {
      return buildClientErrorPayload("provider_http_401", 401, provider, model);
    }
    if (providerHttp.status === 403) {
      return buildClientErrorPayload("provider_http_403", 403, provider, model);
    }
    if (providerHttp.status === 404) {
      const code = looksLikeModelMissing(providerHttp.upstreamBody)
        ? "provider_model_not_found"
        : "provider_http_404";
      return buildClientErrorPayload(code, 404, provider, model);
    }
    if (providerHttp.status === 429) {
      return buildClientErrorPayload("provider_http_429", 429, provider, model);
    }
    return buildClientErrorPayload(
      "provider_upstream_error",
      providerHttp.status >= 400 ? providerHttp.status : 502,
      provider,
      model,
    );
  }

  return buildClientErrorPayload(
    "unknown_internal_error",
    500,
    fallbackProvider,
    fallbackModel,
  );
}

// ----------------- Provider Calls -----------------

export async function callGroq(
  body: HandlerRequestBody,
): Promise<{ content: string; raw: unknown; model: string }> {
  const apiKey = getRuntimeEnv("GROQ_API_KEY");
  if (!apiKey) {
    throw new Error("GROQ_API_KEY not set in Edge env");
  }

  const qualityConfig = DEFAULT_MODELS.groq;
  const model =
    body.model ||
    (body.quality === "quality" ? qualityConfig.quality : qualityConfig.speed);

  const url = "https://api.groq.com/openai/v1/chat/completions";

  const doRequest = async (modelId: string) => {
    const res = await fetchWithTimeout(url, {
      timeoutMs: 20_000,
      timeoutMessage: `Groq request timed out after 20000ms: ${url}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: body.messages,
        temperature: 0.2,
        max_tokens: 2048,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return { ok: false as const, status: res.status, text: txt };
    }

    return { ok: true as const, json: await res.json() };
  };

  const primary = await doRequest(model);
  const fallbackModel = model.startsWith("groq/") ? model.slice("groq/".length) : model;

  let json;
  let resolvedModel = model;
  if (primary.ok) {
    json = primary.json;
  } else if (fallbackModel !== model && (primary.status === 404 || /model/i.test(primary.text))) {
    const fallback = await doRequest(fallbackModel);
    if (!fallback.ok) {
      throw providerHttpError("groq", fallbackModel, fallback.status, fallback.text);
    }
    json = fallback.json;
    resolvedModel = fallbackModel;
  } else {
    throw providerHttpError("groq", model, primary.status, primary.text);
  }

  const content =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.delta?.content ??
    "";

  return { content, raw: json, model: resolvedModel };
}

export async function callGemini(
  body: HandlerRequestBody,
): Promise<{ content: string; raw: unknown; model: string }> {
  const apiKey = getRuntimeEnv("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set in Edge env");
  }

  const qualityConfig = DEFAULT_MODELS.gemini;
  const model =
    body.model ||
    (body.quality === "quality" ? qualityConfig.quality : qualityConfig.speed);

  const systemInstructionText = joinSystemMessages(body.messages);
  const nonSystemMessages = body.messages.filter((m) => m.role !== "system");

  const contents = toGeminiContents(
    nonSystemMessages.length > 0
      ? nonSystemMessages
      : [{ role: "user", content: systemInstructionText || "Continue." }],
  );

  const payload = {
    contents,
    ...(systemInstructionText
      ? { systemInstruction: { parts: [{ text: systemInstructionText }] } }
      : {}),
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetchWithTimeout(url, {
    timeoutMs: 20_000,
    timeoutMessage: `Gemini request timed out after 20000ms: ${url}`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw providerHttpError("gemini", model, res.status, txt);
  }

  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p: any) => p.text || "").join("\n");

  return { content: text, raw: json, model };
}

// ----------------- Main Handler -----------------



function toPlainPrompt(messages: ChatMessage[]): string {
  return messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");
}

export async function callOpenAI(
  body: HandlerRequestBody,
): Promise<{ content: string; raw: unknown; model: string }> {
  const apiKey = getRuntimeEnv("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set in Edge env");
  }

  const qualityConfig = DEFAULT_MODELS.openai;
  const model =
    body.model ||
    (body.quality === "quality" ? qualityConfig.quality : qualityConfig.speed);

  const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    timeoutMs: 20_000,
    timeoutMessage: "OpenAI request timed out after 20000ms",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: body.messages,
      temperature: 0.2,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw providerHttpError("openai", model, res.status, txt);
  }

  const json = await res.json();
  const content =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.delta?.content ??
    "";

  return { content, raw: json, model };
}

export async function callAnthropic(
  body: HandlerRequestBody,
): Promise<{ content: string; raw: unknown; model: string }> {
  const apiKey = getRuntimeEnv("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set in Edge env");
  }

  const qualityConfig = DEFAULT_MODELS.anthropic;
  const model =
    body.model ||
    (body.quality === "quality" ? qualityConfig.quality : qualityConfig.speed);

  const system = joinSystemMessages(body.messages);

  const messages = body.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

  const safeMessages =
    messages.length > 0
      ? messages
      : [{ role: "user" as const, content: "Please respond to the system instructions." }];

  const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    timeoutMs: 20_000,
    timeoutMessage: "Anthropic request timed out after 20000ms",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system: system || undefined,
      messages: safeMessages,
      max_tokens: 2048,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw providerHttpError("anthropic", model, res.status, txt);
  }

  const json = await res.json();
  const content = Array.isArray(json?.content)
    ? json.content
        .map((part: any) => (part?.type === "text" ? String(part.text || "") : ""))
        .join("\n")
    : "";

  return { content, raw: json, model };
}

export async function callHuggingFace(
  body: HandlerRequestBody,
): Promise<{ content: string; raw: unknown; model: string }> {
  const apiKey = getRuntimeEnv("HUGGINGFACE_API_KEY");
  if (!apiKey) {
    throw new Error("HUGGINGFACE_API_KEY not set in Edge env");
  }

  const qualityConfig = DEFAULT_MODELS.huggingface;
  const model =
    body.model ||
    (body.quality === "quality" ? qualityConfig.quality : qualityConfig.speed);

  const prompt = toPlainPrompt(body.messages);

  const res = await fetchWithTimeout(`https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`, {
    timeoutMs: 20_000,
    timeoutMessage: `HuggingFace request timed out after 20000ms: ${model}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        return_full_text: false,
        max_new_tokens: 1024,
        temperature: 0.2,
      },
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw providerHttpError("huggingface", model, res.status, txt);
  }

  const json = await res.json();
  const content = Array.isArray(json)
    ? String(json?.[0]?.generated_text || "")
    : String(json?.generated_text || "");

  return { content, raw: json, model };
}
