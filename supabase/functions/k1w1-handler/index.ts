// supabase/functions/k1w1-handler/index.ts
// REFACTORED: helpers → helpers.ts

import { callAnthropic, callGemini, callGroq, callHuggingFace, callOpenAI, classifyK1w1HandlerError, corsHeadersForRequest, getRequestRateLimitSubject, handleCors, parseJsonBody, parseRequestBody, rateLimit, requireAiOperatorJwtRoleWithVerifiedActor, requireDurableRateLimit } from "./helpers.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const responseCorsHeaders = corsHeadersForRequest(req);

  const jwtActorGuard = await requireAiOperatorJwtRoleWithVerifiedActor(req, "k1w1-handler");
  if (jwtActorGuard.guard) return jwtActorGuard.guard;
  const rateLimitSubject = getRequestRateLimitSubject(req, jwtActorGuard.actor);

  const durableRl = await requireDurableRateLimit(req, {
    scope: "k1w1-handler",
    subject: rateLimitSubject,
    max: 20,
    windowMs: 60_000,
    // AI route: fail closed when the durable counter store is unavailable.
    enforceDurable: true,
  });
  if (durableRl) return durableRl;

  // Defense-in-depth: local limiter still smooths bursts per warm instance,
  // while durable limiter above is the source of truth across instances.
  const rl = rateLimit(req, "k1w1-handler", 20, 60_000, rateLimitSubject);
  if (rl) return rl;

  if (req.method !== "POST") {
    return new Response("Methode nicht erlaubt", {
      status: 405,
      headers: responseCorsHeaders,
    });
  }

  const shouldDebugLogRequests = Deno.env.get("K1W1_HANDLER_DEBUG_LOG") === "true";

  let requestProvider: string | undefined;
  let requestModel: string | undefined;

  try {
    const parsedBody = await parseJsonBody(req, 200_000);
    if (!parsedBody.ok) {
      const parseError = (parsedBody as { ok: false; error: string }).error;
      const parseErrorText =
        typeof parseError === "string" ? parseError.toLowerCase() : "";
      const isTooLarge = parseErrorText.includes("too large");
      const errorPayload = {
        ok: false as const,
        code: "invalid_request_payload" as const,
        error: isTooLarge ? "Anfrage zu gross." : "Ungueltige Anfrage-Nutzlast.",
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

    if (shouldDebugLogRequests) {
      console.warn(
        "🧠 k1w1-handler request",
        JSON.stringify({
          provider: body.provider,
          quality: body.quality,
          mode: body.mode,
          model: body.model,
          msgCount: body.messages.length,
        }),
      );
    }

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
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: {
        ...responseCorsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (err: unknown) {
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
      }),
      errorPayload.code === "unknown_internal_error" ? rawStack : undefined,
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
