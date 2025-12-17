// supabase/functions/k1w1-handler/index.ts
// Zentraler KI-Handler für k1w1-a0style.
// - Nimmt OpenAI-Style messages entgegen
// - Ruft je nach provider Groq oder Gemini auf
// - Verwendet NUR Server-Env-Keys (GROQ_API_KEY, GEMINI_API_KEY)
// - Kein API-Key mehr im Request-Body nötig.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

type Role = "system" | "user" | "assistant";

interface ChatMessage {
  role: Role;
  content: string;
}

interface HandlerRequestBody {
  provider: "groq" | "gemini" | string;
  messages: ChatMessage[];
  mode?: string;
  model?: string;
  quality?: "speed" | "quality";
}

import { corsHeaders, handleCors } from "../_shared/cors.ts";

const DEFAULT_MODELS = {
  groq: {
    speed: "llama-3.1-8b-instant",
    quality: "llama-3.3-70b-versatile",
  },
  gemini: {
    speed: "gemini-1.5-flash",
    quality: "gemini-1.5-pro",
  },
} as const;

// ----------------- Helpers -----------------

function parseRequestBody(body: unknown): HandlerRequestBody {
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
  const quality =
    (b.quality === "quality" || b.quality === "speed"
      ? b.quality
      : "speed") as "speed" | "quality";

  return {
    provider,
    messages: b.messages as ChatMessage[],
    mode: typeof b.mode === "string" ? b.mode : "builder",
    model: typeof b.model === "string" ? b.model : undefined,
    quality,
  };
}

function toGeminiContents(messages: ChatMessage[]) {
  // OpenAI → Gemini Mapping
  return messages.map((m) => ({
    role:
      m.role === "assistant"
        ? "model"
        : m.role === "user"
        ? "user"
        : "user",
    parts: [{ text: m.content }],
  }));
}

// ----------------- Provider Calls -----------------

async function callGroq(
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

  const res = await fetch(url, {
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
    throw new Error(`groq_http_${res.status}: ${txt}`);
  }

  const json = await res.json();
  const content =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.delta?.content ??
    "";

  return { content, raw: json, model };
}

async function callGemini(
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

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`gemini_http_${res.status}: ${txt}`);
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

serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const bodyJson = await req.json().catch(() => null);
    const body = parseRequestBody(bodyJson);

    console.log(
      "🧠 k1w1-handler request",
      JSON.stringify({
        provider: body.provider,
        quality: body.quality,
        mode: body.mode,
        model: body.model,
        msgCount: body.messages.length,
      }),
    );

    let result;
    const providerLower = body.provider.toLowerCase();

    if (providerLower === "groq") {
      result = await callGroq(body);
    } else if (providerLower === "gemini") {
      result = await callGemini(body);
    } else {
      throw new Error(`Unsupported provider: ${body.provider}`);
    }

    const responsePayload = {
      ok: true as const,
      provider: providerLower,
      model: result.model,
      content: result.content,
      raw: result.raw,
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (err: any) {
    console.error("❌ k1w1-handler error", err?.message, err?.stack, err);

    const errorPayload = {
      ok: false as const,
      error: err?.message || "Unknown error",
    };

    // Use 500 for unexpected errors, 400 for validation errors
    const statusCode = err?.message?.includes("Missing") || err?.message?.includes("Invalid") 
      ? 400 
      : 500;

    return new Response(JSON.stringify(errorPayload), {
      status: statusCode,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
