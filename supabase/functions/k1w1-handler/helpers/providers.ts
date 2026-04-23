import { getRuntimeEnv } from "../../_shared/auth.ts";
import { fetchWithTimeout } from "../../_shared/fetchWithTimeout.ts";
import { providerHttpError } from "./errors.ts";
import { joinSystemMessages, resolveDefaultModelForQuality, resolveProviderModelForRuntime, toGeminiContents, toPlainPrompt } from "./request.ts";
import { asRecord, readAnthropicTextParts, readGeminiTextParts } from "./textParts.ts";
import { DEFAULT_MODELS, DEFAULT_PROVIDER_TEMPERATURE, PROVIDER_UPSTREAM_TIMEOUT_MS } from "./types.ts";
import type { HandlerRequestBody } from "./types.ts";


function isGroqModelNotFoundError(status: number, bodyText: string): boolean {
  if (status !== 404) return false;

  const normalized = bodyText.toLowerCase();
  const strongNotFoundNeedles = [
    'model_not_found',
    'model not found',
    'unknown model',
    'invalid model',
  ];

  if (strongNotFoundNeedles.some((needle) => normalized.includes(needle))) {
    return true;
  }

  return normalized.includes("does not exist") && normalized.includes("model");
}

export async function callGroq(
  body: HandlerRequestBody,
): Promise<{ content: string; model: string; runtimeNote?: string }> {
  const apiKey = getRuntimeEnv("GROQ_API_KEY");
  if (!apiKey) {
    throw new Error("GROQ_API_KEY not set in Edge env");
  }

  const qualityConfig = DEFAULT_MODELS.groq;
  const selectedModel =
    body.model ||
    resolveDefaultModelForQuality(qualityConfig, body.quality);
  const resolvedSelection = resolveProviderModelForRuntime("groq", selectedModel);
  const model = resolvedSelection.runtimeModel;

  const url = "https://api.groq.com/openai/v1/chat/completions";

  const doRequest = async (modelId: string) => {
    const res = await fetchWithTimeout(url, {
      timeoutMs: PROVIDER_UPSTREAM_TIMEOUT_MS,
      timeoutMessage: `Groq request timed out after ${PROVIDER_UPSTREAM_TIMEOUT_MS}ms`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: body.messages,
        temperature: DEFAULT_PROVIDER_TEMPERATURE,
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
  const fallbackModel = model.includes("/") ? model.slice(model.lastIndexOf("/") + 1) : model;

  let json;
  if (primary.ok) {
    json = primary.json;
  } else if (fallbackModel !== model && isGroqModelNotFoundError(primary.status, primary.text)) {
    const fallback = await doRequest(fallbackModel);
    if (!fallback.ok) {
      throw providerHttpError("groq", fallbackModel, fallback.status, fallback.text);
    }
    json = fallback.json;
  } else {
    throw providerHttpError("groq", model, primary.status, primary.text);
  }

  const content =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.delta?.content ??
    "";

  return { content, model: resolvedSelection.visibleModel, runtimeNote: resolvedSelection.runtimeNote };
}

export async function callGemini(
  body: HandlerRequestBody,
): Promise<{ content: string; model: string; runtimeNote?: string }> {
  const apiKey = getRuntimeEnv("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set in Edge env");
  }

  const qualityConfig = DEFAULT_MODELS.gemini;
  const selectedModel =
    body.model ||
    resolveDefaultModelForQuality(qualityConfig, body.quality);
  const resolvedModel = resolveProviderModelForRuntime("gemini", selectedModel);
  const model = resolvedModel.runtimeModel;

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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const res = await fetchWithTimeout(url, {
    timeoutMs: PROVIDER_UPSTREAM_TIMEOUT_MS,
    timeoutMessage: `Gemini request timed out after ${PROVIDER_UPSTREAM_TIMEOUT_MS}ms`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw providerHttpError("gemini", model, res.status, txt);
  }

  const json = await res.json();
  const candidate = Array.isArray(json?.candidates) ? json.candidates[0] : null;
  const candidateRecord = asRecord(candidate);
  const contentRecord = asRecord(candidateRecord?.content);
  const text = readGeminiTextParts(contentRecord?.parts);

  return { content: text, model: resolvedModel.visibleModel, runtimeNote: resolvedModel.runtimeNote };
}

export async function callOpenAI(
  body: HandlerRequestBody,
): Promise<{ content: string; model: string; runtimeNote?: string }> {
  const apiKey = getRuntimeEnv("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set in Edge env");
  }

  const qualityConfig = DEFAULT_MODELS.openai;
  const selectedModel =
    body.model ||
    resolveDefaultModelForQuality(qualityConfig, body.quality);
  const resolvedModel = resolveProviderModelForRuntime("openai", selectedModel);
  const model = resolvedModel.runtimeModel;

  const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    timeoutMs: PROVIDER_UPSTREAM_TIMEOUT_MS,
    timeoutMessage: `OpenAI request timed out after ${PROVIDER_UPSTREAM_TIMEOUT_MS}ms`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: body.messages,
      temperature: DEFAULT_PROVIDER_TEMPERATURE,
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

  return { content, model: resolvedModel.visibleModel, runtimeNote: resolvedModel.runtimeNote };
}

export async function callAnthropic(
  body: HandlerRequestBody,
): Promise<{ content: string; model: string; runtimeNote?: string }> {
  const apiKey = getRuntimeEnv("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set in Edge env");
  }

  const qualityConfig = DEFAULT_MODELS.anthropic;
  const selectedModel =
    body.model ||
    resolveDefaultModelForQuality(qualityConfig, body.quality);
  const resolvedModel = resolveProviderModelForRuntime("anthropic", selectedModel);
  const model = resolvedModel.runtimeModel;

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
    timeoutMs: PROVIDER_UPSTREAM_TIMEOUT_MS,
    timeoutMessage: `Anthropic request timed out after ${PROVIDER_UPSTREAM_TIMEOUT_MS}ms`,
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
      temperature: DEFAULT_PROVIDER_TEMPERATURE,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw providerHttpError("anthropic", model, res.status, txt);
  }

  const json = await res.json();
  const content = readAnthropicTextParts(json?.content);

  return { content, model: resolvedModel.visibleModel, runtimeNote: resolvedModel.runtimeNote };
}

export async function callHuggingFace(
  body: HandlerRequestBody,
): Promise<{ content: string; model: string; runtimeNote?: string }> {
  const apiKey = getRuntimeEnv("HUGGINGFACE_API_KEY");
  if (!apiKey) {
    throw new Error("HUGGINGFACE_API_KEY not set in Edge env");
  }

  const qualityConfig = DEFAULT_MODELS.huggingface;
  const selectedModel =
    body.model ||
    resolveDefaultModelForQuality(qualityConfig, body.quality);
  const resolvedModel = resolveProviderModelForRuntime("huggingface", selectedModel);
  const model = resolvedModel.runtimeModel;

  const prompt = toPlainPrompt(body.messages);

  const res = await fetchWithTimeout(`https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`, {
    timeoutMs: PROVIDER_UPSTREAM_TIMEOUT_MS,
    timeoutMessage: `HuggingFace request timed out after ${PROVIDER_UPSTREAM_TIMEOUT_MS}ms`,
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
        temperature: DEFAULT_PROVIDER_TEMPERATURE,
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

  return { content, model: resolvedModel.visibleModel, runtimeNote: resolvedModel.runtimeNote };
}
