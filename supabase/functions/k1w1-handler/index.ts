// supabase/functions/k1w1-handler/index.ts
// REFACTORED: helpers → helpers.ts

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { Role,ChatMessage,HandlerRequestBody,DEFAULT_MODELS,parseRequestBody,toGeminiContents,callGroq,callGemini,callOpenAI,callAnthropic,callHuggingFace,corsHeaders,handleCors,parseJsonBody,rateLimit,requireAdminKey } from "./helpers.ts";

serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const auth = requireAdminKey(req);
  if (auth) return auth;

  const rl = rateLimit(req, "k1w1-handler");
  if (rl) return rl;

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const parsedBody = await parseJsonBody(req, 200_000);
    if (!parsedBody.ok) {
      const isTooLarge = parsedBody.error.toLowerCase().includes("too large");
      return new Response(
        JSON.stringify({ ok: false, error: parsedBody.error }),
        {
          status: isTooLarge ? 413 : 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const bodyJson = parsedBody.body;
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
    } else if (providerLower === "openai") {
      result = await callOpenAI(body);
    } else if (providerLower === "anthropic") {
      result = await callAnthropic(body);
    } else if (providerLower === "huggingface") {
      result = await callHuggingFace(body);
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
    const statusCode =
      err?.message?.includes("Missing") || err?.message?.includes("Invalid")
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
