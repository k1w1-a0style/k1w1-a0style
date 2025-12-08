// supabase/functions/k1w1-handler/index.ts
// Zentraler KI-Handler für k1w1-a0style.
// - Nimmt OpenAI-Style messages entgegen
// - Ruft je nach provider Groq oder Gemini auf
// - Verwendet NUR Server-Env-Keys (GROQ_API_KEY, GEMINI_API_KEY)
// - Kein API-Key mehr im Request-Body nötig.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Default-Modelle (kannst du bei Bedarf anpassen)
const DEFAULT_MODELS = {
  groq: {
    speed: "llama-3.1-8b-instant",
    quality: "llama-3.1-70b-versatile",
  },
  gemini: {
    speed: "gemini-1.5-flash-002",
    quality: "gemini-1.5-pro-002",
  },
};

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------
function parseRequestBody(b: any): HandlerRequestBody {
  if (!b || typeof b !== "object") {
    throw new Error("Invalid JSON body");
  }
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
    mode: typeof b.mode === "string" ? b.mode : undefined,
    model: typeof b.model === "string" ? b.model : undefined,
    quality,
  };
}

/**
 * Baut den Prompt für Gemini als "contents"-Array.
 * Wir packen alles in eine USER-Nachricht, inkl. System/Assistant Rollen.
 */
function toGeminiContents(messages: ChatMessage[]) {
  const systemParts: string[] = [];
  const otherParts: string[] = [];

  for (const m of messages) {
    if (m.role === "system") {
      systemParts.push(m.content);
    } else {
      otherParts.push(`${m.role.toUpperCase()}: ${m.content}`);
    }
  }

  const text =
    (systemParts.length
      ? `SYSTEM:\n${systemParts.join("\n")}\n\n`
      : "") + otherParts.join("\n");

  return [
    {
      role: "user",
      parts: [{ text }],
    },
  ];
}

/**
 * Wählt die passende Gemini API-Version anhand des Modellnamens.
 * - 2.0 / exp → v1beta
 * - Rest (1.5-Modelle, stabile) → v1
 */
function geminiApiVersionForModel(model: string): "v1" | "v1beta" {
  const m = model.toLowerCase();
  if (m.includes("2.0") || m.includes("exp")) return "v1beta";
  return "v1";
}

// ----------------------------------------------------------
// Provider Calls
// ----------------------------------------------------------
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

  const json: any = await res.json();
  const content =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.text ??
    JSON.stringify(json);

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

  const apiVersion = geminiApiVersionForModel(model);
  const url =
    `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(
      model,
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`gemini_http_${res.status}: ${txt}`);
  }

  const json: any = await res.json();
  const parts =
    json?.candidates?.[0]?.content?.parts ??
    json?.candidates?.[0]?.content?.parts ??
    [];
  const text = (parts as any[]).map((p) => p.text || "").join("\n");

  return { content: text, raw: json, model };
}

// ----------------------------------------------------------
// Main Handler
// ----------------------------------------------------------
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

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

    let result:
      | { content: string; raw: unknown; model: string }
      | undefined = undefined;

    const providerLower = body.provider.toLowerCase();

    if (providerLower === "groq") {
      result = await callGroq(body);
    } else if (providerLower === "gemini" || providerLower === "google") {
      // google → Alias für Gemini
      result = await callGemini(body);
    } else {
      throw new Error(`Unsupported provider: ${body.provider}`);
    }

    const responsePayload = {
      ok: true as const,
      provider: providerLower,
      model: result.model,
      text: result.content,
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
    console.error("❌ k1w1-handler error", err);

    const errorPayload = {
      ok: false as const,
      error: err?.message || "Unknown error",
    };

    return new Response(JSON.stringify(errorPayload), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
