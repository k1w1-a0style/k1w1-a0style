// supabase/functions/k1w1-handler/index.ts
// REFACTORED: helpers → helpers.ts

import { callAnthropic, callGemini, callGroq, callHuggingFace, callOpenAI, classifyK1w1HandlerError, corsHeadersForRequest, handleCors, parseJsonBody, parseRequestBody, rateLimit, requireAdminKey } from "./helpers.ts";

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

  let requestProvider: string | undefined;
  let requestModel: string | undefined;

  try {
    const parsedBody = await parseJsonBody(req, 200_000);
    if (!parsedBody.ok) {
      const parseErrorText =
        typeof parsedBody.error === "string" ? parsedBody.error.toLowerCase() : "";
      const isTooLarge = parseErrorText.includes("too large");
      const errorPayload = {
        ok: false as const,
        code: "invalid_request_payload" as const,
        error: isTooLarge ? "Request too large." : "Invalid request payload.",
        status: isTooLarge ? 413 : 400,
      };
      return new Response(JSON.stringify(errorPayload), {
        status: isTooLarge ? 413 : 400,
        headers: { ...responseCorsHeaders, "Content-Type": "application/json" },
      });
    }
    const bodyJson = parsedBody.body;
    const body = parseRequestBody(bodyJson);
    requestProvider = body.provider;
    requestModel = body.model;

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
      ...(result.runtimeNote ? { runtime_note: result.runtimeNote } : {}),
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
    const rawMessage = err instanceof Error ? err.message : String(err ?? "");
    const rawStack = err instanceof Error ? err.stack : undefined;
    const errorPayload = classifyK1w1HandlerError(err, {
      provider: requestProvider,
      model: requestModel,
    });

    console.error(
      "❌ k1w1-handler error",
      JSON.stringify({
        code: errorPayload.code,
        provider: errorPayload.provider,
        model: errorPayload.model,
        status: errorPayload.status,
        message: rawMessage || "Unknown error",
      }),
      rawStack,
    );

    return new Response(JSON.stringify(errorPayload), {
      status: errorPayload.status,
      headers: {
        ...responseCorsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
