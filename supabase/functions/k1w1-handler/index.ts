// supabase/functions/k1w1-handler/index.ts
// REFACTORED: helpers → helpers.ts

import { callAnthropic, callGemini, callGroq, callHuggingFace, callOpenAI, corsHeadersForRequest, handleCors, parseJsonBody, parseRequestBody, rateLimit, requireAdminKey } from "./helpers.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const responseCorsHeaders = corsHeadersForRequest(req);

  const auth = requireAdminKey(req);
  if (auth) return auth;

  const rl = rateLimit(req, "k1w1-handler");
  if (rl) return rl;

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: responseCorsHeaders,
    });
  }

  try {
    const parsedBody = await parseJsonBody(req, 200_000);
    if (!parsedBody.ok) {
      const parseErrorText =
        typeof parsedBody.error === "string" ? parsedBody.error.toLowerCase() : "";
      const isTooLarge = parseErrorText.includes("too large");
      return new Response(
        JSON.stringify({
          ok: false,
          error: isTooLarge ? "Request too large." : "Invalid request payload.",
        }),
        {
          status: isTooLarge ? 413 : 400,
          headers: { ...responseCorsHeaders, "Content-Type": "application/json" },
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
        ...responseCorsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : "";
    const rawStack = err instanceof Error ? err.stack : undefined;
    console.error("❌ k1w1-handler error", rawMessage || "Unknown error", rawStack, err);

    const isValidationError =
      rawMessage.includes("Missing") ||
      rawMessage.includes("Invalid") ||
      rawMessage.includes("Unsupported provider") ||
      rawMessage.includes("request body") ||
      rawMessage.includes("messages");

    const errorPayload = {
      ok: false as const,
      error: isValidationError
        ? "Invalid request payload."
        : "Internal Server Error",
    };

    const statusCode = isValidationError ? 400 : 500;

    return new Response(JSON.stringify(errorPayload), {
      status: statusCode,
      headers: {
        ...responseCorsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
