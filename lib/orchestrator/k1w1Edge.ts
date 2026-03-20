import { getEdgeAdminKey } from '../../infra/github/githubService';
import { ensureSupabaseClient } from '../supabase';
import { SUPABASE_EDGE_FUNCTIONS } from '../../shared/constants/supabase';

import type { AllAIProviders } from '../../contexts/AIContext';
import type { LlmMessage, OrchestratorResult, Quality } from './types';

export type K1w1HandlerPayload = {
  ok?: boolean;
  provider?: string;
  model?: string;
  content?: string;
  error?: string;
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

async function extractInvokeErrorMessage(error: unknown): Promise<string> {
  if (!error || typeof error !== 'object') {
    return `Edge-Request fehlgeschlagen: ${getErrorMessage(error)}`;
  }

  const withContext = error as { context?: unknown; message?: unknown; name?: unknown };
  const response = withContext.context instanceof Response ? withContext.context : null;

  if (response) {
    const json = await readResponseJson(response);
    const payloadError = typeof json?.error === 'string' ? json.error.trim() : '';
    if (payloadError) {
      return payloadError;
    }

    const text = (await readResponseText(response)).trim();
    if (text) {
      return `Edge-Request fehlgeschlagen (${response.status}): ${text}`;
    }

    return `Edge-Request fehlgeschlagen (${response.status}).`;
  }

  const msg = typeof withContext.message === 'string' ? withContext.message.trim() : '';
  if (msg) {
    return `Edge-Request fehlgeschlagen: ${msg}`;
  }

  return 'Edge-Request fehlgeschlagen.';
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
    return {
      ok: false,
      error:
        typeof payload?.error === 'string' && payload.error.trim()
          ? payload.error.trim()
          : 'Edge-Handler lieferte keinen gueltigen Erfolgs-Response.',
      provider,
      model,
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
  const edgeAdminKey = await getEdgeAdminKey().catch(() => null);

  if (!edgeAdminKey) {
    return {
      ok: false,
      error:
        'K1W1_EDGE_ADMIN_KEY fehlt. Bitte den Edge Admin Key lokal setzen, damit produktive KI-Requests ueber den k1w1-handler laufen koennen.',
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
      const errorMessage = timedOut
        ? `Request timeout nach ${timeoutMs}ms`
        : signal?.aborted || isAbortError(error)
          ? 'Request abgebrochen'
          : await extractInvokeErrorMessage(error);
      return { ok: false, error: errorMessage, provider, model };
    }

    return normalizeHandlerPayload(data, provider, model);
  } catch (error: unknown) {
    if (timedOut) {
      return { ok: false, error: `Request timeout nach ${timeoutMs}ms`, provider, model };
    }
    if (signal?.aborted || isAbortError(error)) {
      return { ok: false, error: 'Request abgebrochen', provider, model };
    }
    return {
      ok: false,
      error: await extractInvokeErrorMessage(error),
      provider,
      model,
    };
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onAbort);
  }
}
