import { getLegacyEdgeAdminKey } from '../../infra/github/githubService';
import { ensureSupabaseClient } from '../supabase';
import { SUPABASE_EDGE_FUNCTIONS } from '../../shared/constants/supabase';

import type { AllAIProviders } from '../../contexts/AIContext';
import type { LlmMessage, OrchestratorResult, Quality } from './types';

export type K1w1HandlerErrorCode =
  | 'provider_env_missing'
  | 'provider_http_401'
  | 'provider_http_403'
  | 'provider_http_404'
  | 'provider_http_429'
  | 'provider_model_not_found'
  | 'provider_upstream_error'
  | 'invalid_request_payload'
  | 'unsupported_provider'
  | 'unknown_internal_error';

export type K1w1HandlerPayload = {
  ok?: boolean;
  provider?: string;
  model?: string;
  content?: string;
  error?: string;
  code?: K1w1HandlerErrorCode;
  status?: number;
  runtime_note?: string;
};

type InvokeK1w1HandlerArgs = {
  provider: AllAIProviders;
  model: string;
  quality: Quality;
  messages: LlmMessage[];
  signal?: AbortSignal;
  timeoutMs: number;
};

function isAbortError(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'name' in error && (error as { name?: unknown }).name === 'AbortError';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function providerLabel(provider: string): string {
  const normalized = provider.trim();
  if (!normalized) return 'Der Provider';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function mapHandlerErrorCodeToMessage(
  code: K1w1HandlerErrorCode | undefined,
  provider: string,
  model: string,
): string {
  const label = providerLabel(provider);
  const safeModel = model.trim();

  switch (code) {
    case 'provider_env_missing':
      return `${label} ist serverseitig nicht konfiguriert.`;
    case 'provider_http_401':
      return `${label} lehnt den Server-Request ab (401). Bitte Provider-Key oder Account-Berechtigungen pruefen.`;
    case 'provider_http_403':
      return `${label} verweigert den Zugriff auf den angeforderten KI-Request (403).`;
    case 'provider_http_404':
      return `${label} konnte die angeforderte Ressource nicht finden (404).`;
    case 'provider_http_429':
      return `${label} meldet ein Rate-Limit oder ist voruebergehend ueberlastet (429).`;
    case 'provider_model_not_found':
      return safeModel
        ? `Das Modell "${safeModel}" ist bei ${label} nicht verfuegbar oder wird dort nicht unterstuetzt.`
        : `${label} meldet, dass das angeforderte Modell nicht verfuegbar ist.`;
    case 'provider_upstream_error':
      return `${label} hat den KI-Request serverseitig nicht erfolgreich verarbeitet.`;
    case 'invalid_request_payload':
      return 'Invalid request payload.';
    case 'unsupported_provider':
      return provider.trim()
        ? `Der Provider "${provider.trim()}" wird vom k1w1-handler nicht unterstuetzt.`
        : 'Der angeforderte KI-Provider wird vom k1w1-handler nicht unterstuetzt.';
    case 'unknown_internal_error':
      return 'Internal Server Error';
    default:
      return 'Edge-Handler lieferte keinen gueltigen Erfolgs-Response.';
  }
}

async function readResponseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

async function readResponseJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const json = await response.json();
    return isRecord(json) ? json : null;
  } catch {
    return null;
  }
}

function resolveHandlerError(
  payload: K1w1HandlerPayload | null | undefined,
  fallbackProvider: AllAIProviders,
  fallbackModel: string,
): { provider: string; model: string; message: string } {
  const provider = typeof payload?.provider === 'string' && payload.provider.trim()
    ? payload.provider.trim()
    : fallbackProvider;
  const model = typeof payload?.model === 'string' && payload.model.trim()
    ? payload.model.trim()
    : fallbackModel;
  const explicitError = typeof payload?.error === 'string' ? payload.error.trim() : '';

  return {
    provider,
    model,
    message: explicitError || mapHandlerErrorCodeToMessage(payload?.code, provider, model),
  };
}

async function extractInvokeErrorResult(
  error: unknown,
  fallbackProvider: AllAIProviders,
  fallbackModel: string,
): Promise<OrchestratorResult> {
  if (!error || typeof error !== 'object') {
    return {
      ok: false,
      error: `Edge-Request fehlgeschlagen: ${getErrorMessage(error)}`,
      provider: fallbackProvider,
      model: fallbackModel,
    };
  }

  const withContext = error as { context?: unknown; message?: unknown };
  const response = withContext.context instanceof Response ? withContext.context : null;

  if (response) {
    const json = await readResponseJson(response.clone());
    if (json) {
      const normalized = normalizeHandlerPayload(json as K1w1HandlerPayload, fallbackProvider, fallbackModel);
      if (!normalized.ok) {
        return normalized;
      }
    }

    const text = (await readResponseText(response)).trim();
    if (text) {
      return {
        ok: false,
        error: `Edge-Request fehlgeschlagen (${response.status}): ${text}`,
        provider: fallbackProvider,
        model: fallbackModel,
      };
    }

    return {
      ok: false,
      error: `Edge-Request fehlgeschlagen (${response.status}).`,
      provider: fallbackProvider,
      model: fallbackModel,
    };
  }

  const msg = typeof withContext.message === 'string' ? withContext.message.trim() : '';
  return {
    ok: false,
    error: msg ? `Edge-Request fehlgeschlagen: ${msg}` : 'Edge-Request fehlgeschlagen.',
    provider: fallbackProvider,
    model: fallbackModel,
  };
}

function normalizeHandlerPayload(
  payload: K1w1HandlerPayload | null | undefined,
  fallbackProvider: AllAIProviders,
  fallbackModel: string,
): OrchestratorResult {
  const provider = typeof payload?.provider === 'string' && payload.provider.trim()
    ? payload.provider.trim()
    : fallbackProvider;
  const model = typeof payload?.model === 'string' && payload.model.trim()
    ? payload.model.trim()
    : fallbackModel;

  if (!payload || payload.ok !== true) {
    const resolved = resolveHandlerError(payload, fallbackProvider, fallbackModel);
    return {
      ok: false,
      error: resolved.message,
      provider: resolved.provider,
      model: resolved.model,
      errorCode: payload?.code,
      statusCode: typeof payload?.status === 'number' ? payload.status : undefined,
    };
  }

  const text = typeof payload.content === 'string' ? payload.content.trim() : '';
  if (!text) {
    return {
      ok: false,
      error: 'Keine Antwort vom Edge-Handler erhalten.',
      provider,
      model,
    };
  }

  return {
    ok: true,
    text,
    provider,
    model,
    runtimeNote: typeof payload.runtime_note === 'string' ? payload.runtime_note.trim() || undefined : undefined,
  };
}

export async function invokeK1w1Handler({
  provider,
  model,
  quality,
  messages,
  signal,
  timeoutMs,
}: InvokeK1w1HandlerArgs): Promise<OrchestratorResult> {
  const supabase = await ensureSupabaseClient();
  const edgeAdminKey = await getLegacyEdgeAdminKey().catch(() => null);

  if (!edgeAdminKey) {
    return {
      ok: false,
      error:
        'Lokaler Legacy Edge Admin Key (compat/Sunset) fehlt. k1w1-handler nutzt derzeit noch K1W1_EDGE_ADMIN_KEY; bitte den lokalen Compat-Key nur fuer diesen Altpfad setzen und scoped Keys fuer Workflow/Keystore getrennt pflegen.',
      provider,
      model,
    };
  }

  const requestController = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    requestController.abort();
  }, timeoutMs);
  const onAbort = () => requestController.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const { data, error } = await supabase.functions.invoke<K1w1HandlerPayload>(
      SUPABASE_EDGE_FUNCTIONS.K1W1_HANDLER,
      {
        body: {
          provider,
          model,
          quality,
          messages,
        },
        headers: {
          'x-k1w1-admin-key': edgeAdminKey,
        },
        signal: requestController.signal,
      },
    );

    if (error) {
      if (timedOut) {
        return { ok: false, error: `Request timeout nach ${timeoutMs}ms`, provider, model };
      }
      if (signal?.aborted || isAbortError(error)) {
        return { ok: false, error: 'Request abgebrochen', provider, model };
      }
      return await extractInvokeErrorResult(error, provider, model);
    }

    return normalizeHandlerPayload(data, provider, model);
  } catch (error: unknown) {
    if (timedOut) {
      return { ok: false, error: `Request timeout nach ${timeoutMs}ms`, provider, model };
    }
    if (signal?.aborted || isAbortError(error)) {
      return { ok: false, error: 'Request abgebrochen', provider, model };
    }
    return await extractInvokeErrorResult(error, provider, model);
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onAbort);
  }
}
