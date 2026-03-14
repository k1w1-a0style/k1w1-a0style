// supabase/functions/k1w1-handler/helpers.ts
// Extracted from index.ts

// supabase/functions/k1w1-handler/index.ts
// Zentraler KI-Handler für k1w1-a0style.
// - Nimmt OpenAI-Style messages entgegen
// - Ruft je nach provider Groq oder Gemini auf
// - Verwendet NUR Server-Env-Keys (GROQ_API_KEY, GEMINI_API_KEY)
// - Kein API-Key mehr im Request-Body nötig.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

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

export { corsHeaders, handleCors } from "../_shared/cors.ts";
export { requireAdminKey, rateLimit } from "../_shared/auth.ts";
export { parseJsonBody } from "../_shared/validation.ts";

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

function providerHttpError(
  provider: string,
  model: string,
  status: number,
  bodyText: string,
): Error {
  return new Error(`${provider}_http_${status} (model=${model}): ${bodyText}`);
}

// ----------------- Provider Calls -----------------

export async function callGroq(
  body: HandlerRequestBody,
): Promise<{ content: string; raw: unknown; model: string }> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) {
    throw new Error("GROQ_API_KEY not set in Edge env");
  }

  const qualityConfig = DEFAULT_MODELS.groq;
  const model =
    body.model ||
    (body.quality === "quality" ? qualityConfig.quality : qualityConfig.speed);

  const url = "https://api.groq.com/openai/v1/chat/completions";

  const doRequest = async (modelId: string) => {
    const res = await fetch(url, {
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
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set in Edge env");
  }

  const qualityConfig = DEFAULT_MODELS.gemini;
  const model =
    body.model ||
    (body.quality === "quality" ? qualityConfig.quality : qualityConfig.speed);

  const contents = toGeminiContents(body.messages);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw providerHttpError("gemini", model, res.status, txt);
  }

  const json = await res.json();
  const parts =
    json?.candidates?.[0]?.content?.parts ??
    json?.candidates?.[0]?.content?.parts ??
    [];
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
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set in Edge env");
  }

  const qualityConfig = DEFAULT_MODELS.openai;
  const model =
    body.model ||
    (body.quality === "quality" ? qualityConfig.quality : qualityConfig.speed);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set in Edge env");
  }

  const qualityConfig = DEFAULT_MODELS.anthropic;
  const model =
    body.model ||
    (body.quality === "quality" ? qualityConfig.quality : qualityConfig.speed);

  const system = body.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n")
    .trim();

  const messages = body.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system: system || undefined,
      messages,
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
  const apiKey = Deno.env.get("HUGGINGFACE_API_KEY");
  if (!apiKey) {
    throw new Error("HUGGINGFACE_API_KEY not set in Edge env");
  }

  const qualityConfig = DEFAULT_MODELS.huggingface;
  const model =
    body.model ||
    (body.quality === "quality" ? qualityConfig.quality : qualityConfig.speed);

  const prompt = toPlainPrompt(body.messages);

  const res = await fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`, {
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
