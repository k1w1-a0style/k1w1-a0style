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
const PROVIDER_MODEL_UNSUPPORTED_PATTERN =
  /^(?<provider>[a-z0-9_-]+)_model_unsupported \(model=(?<model>[^)]+)\):(?<reason>[\s\S]*)$/i;

export function providerHttpError(
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

  const unsupportedModelMatch = rawMessage.match(PROVIDER_MODEL_UNSUPPORTED_PATTERN);
  if (unsupportedModelMatch?.groups) {
    const provider = normalizeProviderName(unsupportedModelMatch.groups.provider) ?? fallbackProvider;
    const model = safeModelLabel(unsupportedModelMatch.groups.model) ?? fallbackModel;
    const payload = buildClientErrorPayload("provider_model_not_found", 404, provider, model);
    const reason = String(unsupportedModelMatch.groups.reason ?? "").trim();
    if (reason) {
      payload.error = `${payload.error} Hinweis: ${reason}`;
    }
    return payload;
  }

  return buildClientErrorPayload(
    "unknown_internal_error",
    500,
    fallbackProvider,
    fallbackModel,
  );
}
