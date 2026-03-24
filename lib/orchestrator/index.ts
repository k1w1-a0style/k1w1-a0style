// lib/orchestrator/index.ts
// REFACTORED: providers split into individual files, helpers & types extracted.

import { providerRateLimiter } from '../RateLimiter';
import { AllAIProviders } from '../../contexts/AIContext';
import { normalizeAiResponse } from '../normalizer';

import type { LlmMessage, OrchestratorResult, Quality } from './types';
import { resolveModel } from './helpers';
import { invokeK1w1Handler } from './k1w1Edge';

export const ORCHESTRATOR_REQUEST_TIMEOUT_MS = 45_000;
export const ORCHESTRATOR_ROTATION_BACKOFF_MS = 350;

// Re-export types so existing imports keep working
export type { LlmMessage, OrchestratorResult } from './types';

function isAbortError(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'name' in error && (error as { name?: unknown }).name === 'AbortError';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

type RuntimeCandidate = {
  provider: AllAIProviders;
  model: string;
  reason: string;
};

const CROSS_PROVIDER_FALLBACK_ORDER: AllAIProviders[] = [
  'openai',
  'anthropic',
  'gemini',
  'groq',
  'huggingface',
];

function shouldAttemptRuntimeFallback(result: OrchestratorResult | null | undefined): boolean {
  const code = String(result?.errorCode || '').trim();
  return (
    code === 'provider_env_missing' ||
    code === 'provider_model_not_found' ||
    code === 'provider_http_404'
  );
}

function buildRuntimeFallbackCandidates(
  provider: AllAIProviders,
  model: string,
  quality: Quality,
  firstFailure: OrchestratorResult | null | undefined,
): RuntimeCandidate[] {
  const seen = new Set<string>();
  const candidates: RuntimeCandidate[] = [];
  const addCandidate = (nextProvider: AllAIProviders, nextModel: string, reason: string) => {
    const normalizedModel = resolveModel(nextProvider, nextModel, quality);
    const key = `${nextProvider}::${normalizedModel}`;
    if (!normalizedModel || seen.has(key)) return;
    seen.add(key);
    candidates.push({ provider: nextProvider, model: normalizedModel, reason });
  };

  addCandidate(provider, model, 'requested');

  const providerDefault = resolveModel(provider, 'auto', quality);
  const firstErrorCode = String(firstFailure?.errorCode || '').trim();
  if (
    providerDefault &&
    providerDefault !== model &&
    (firstErrorCode === 'provider_model_not_found' || firstErrorCode === 'provider_http_404')
  ) {
    addCandidate(provider, providerDefault, `same-provider default for ${quality}`);
  }

  if (firstErrorCode === 'provider_env_missing') {
    for (const fallbackProvider of CROSS_PROVIDER_FALLBACK_ORDER) {
      if (fallbackProvider === provider) continue;
      addCandidate(
        fallbackProvider,
        'auto',
        `${provider} serverseitig nicht konfiguriert`,
      );
    }
  }

  return candidates;
}

function buildRuntimeFallbackNote(params: {
  originalProvider: AllAIProviders;
  originalModel: string;
  finalProvider: string;
  finalModel: string;
  attempts: RuntimeCandidate[];
  firstFailure: OrchestratorResult;
}): string {
  const origin = `${params.originalProvider}/${params.originalModel}`;
  const resolved = `${params.finalProvider}/${params.finalModel}`;
  const firstError = String(params.firstFailure.error || '').trim();
  const attempted = params.attempts
    .slice(1)
    .map((entry) => `${entry.provider}/${entry.model}`)
    .join(', ');
  const attemptSuffix = attempted ? ` Getestete Fallbacks: ${attempted}.` : '';

  return `ℹ️ Runtime-Fallback aktiv: ${origin} konnte nicht direkt genutzt werden (${firstError}). Stattdessen lief der Request über ${resolved}.${attemptSuffix}`;
}

function buildFallbackExhaustedError(params: {
  originalProvider: AllAIProviders;
  originalModel: string;
  attempts: RuntimeCandidate[];
  errors: OrchestratorResult[];
}): string {
  const first = params.errors[0];
  const firstError = String(first?.error || 'Unbekannter Fehler').trim();
  const attemptedFallbacks = params.attempts
    .slice(1)
    .map((entry, index) => {
      const relatedError = params.errors[index + 1];
      const reason = String(relatedError?.error || entry.reason || 'fehlgeschlagen').trim();
      return `${entry.provider}/${entry.model}: ${reason}`;
    })
    .join(' | ');

  if (!attemptedFallbacks) {
    return `${firstError} Es wurde keine serverseitig nutzbare Fallback-Route gefunden.`;
  }

  return `${firstError} Es wurde keine serverseitig nutzbare Fallback-Route gefunden. Fallbacks ebenfalls fehlgeschlagen: ${attemptedFallbacks}`;
}

export function parseFilesFromText(text: string): Array<{ path: string; content: string }> | null {
  return normalizeAiResponse(text);
}

export async function runValidatorOrchestrator(
  provider: AllAIProviders,
  model: string,
  messages: LlmMessage[],
  signal?: AbortSignal,
): Promise<OrchestratorResult> {
  return runOrchestrator(provider, model, 'quality', messages, signal);
}

export async function runOrchestrator(
  provider: AllAIProviders,
  model: string,
  quality: Quality,
  messages: LlmMessage[],
  signal?: AbortSignal,
): Promise<OrchestratorResult> {
  const startMs = Date.now();
  const resolvedModel = resolveModel(provider, model, quality);

  try {
    if (signal?.aborted) {
      const endMs = Date.now();
      return {
        ok: false,
        error: 'Request abgebrochen',
        provider,
        model: resolvedModel,
        timing: { startMs, endMs, durationMs: endMs - startMs },
      };
    }

    const attempts: RuntimeCandidate[] = [];
    const errors: OrchestratorResult[] = [];
    let attemptQueue = buildRuntimeFallbackCandidates(provider, resolvedModel, quality, null);

    while (attemptQueue.length > 0) {
      const attempt = attemptQueue.shift()!;
      attempts.push(attempt);
      await providerRateLimiter.checkLimit(attempt.provider);

      if (signal?.aborted) {
        const endMs = Date.now();
        return {
          ok: false,
          error: 'Request abgebrochen',
          provider: attempt.provider,
          model: attempt.model,
          fallbackUsed: attempts.length > 1,
          fallbackAttempts: attempts.length > 1 ? attempts.slice(1) : undefined,
          timing: { startMs, endMs, durationMs: endMs - startMs },
        };
      }

      const result = await invokeK1w1Handler({
        provider: attempt.provider,
        model: attempt.model,
        quality,
        messages,
        signal,
        timeoutMs: ORCHESTRATOR_REQUEST_TIMEOUT_MS,
      });

      if (result.ok) {
        const endMs = Date.now();
        const runtimeNote =
          attempts.length > 1 && errors[0]
            ? buildRuntimeFallbackNote({
                originalProvider: provider,
                originalModel: resolvedModel,
                finalProvider: result.provider || attempt.provider,
                finalModel: result.model || attempt.model,
                attempts,
                firstFailure: errors[0],
              })
            : result.runtimeNote;
        return {
          ...result,
          provider: result.provider || attempt.provider,
          model: result.model || attempt.model,
          runtimeNote,
          fallbackUsed: attempts.length > 1,
          fallbackAttempts: attempts.length > 1 ? attempts.slice(1) : undefined,
          timing: { startMs, endMs, durationMs: endMs - startMs },
        };
      }

      errors.push({
        ...result,
        provider: result.provider || attempt.provider,
        model: result.model || attempt.model,
      });

      if (attempts.length === 1) {
        attemptQueue = buildRuntimeFallbackCandidates(provider, resolvedModel, quality, errors[0]).slice(1);
        if (attemptQueue.length > 0 && shouldAttemptRuntimeFallback(errors[0])) {
          continue;
        }
      }

      if (!shouldAttemptRuntimeFallback(result)) {
        const endMs = Date.now();
        return {
          ...result,
          provider: result.provider || attempt.provider,
          model: result.model || attempt.model,
          fallbackUsed: attempts.length > 1,
          fallbackAttempts: attempts.length > 1 ? attempts.slice(1) : undefined,
          timing: { startMs, endMs, durationMs: endMs - startMs },
        };
      }
    }

    const endMs = Date.now();
    return {
      ok: false,
      error: buildFallbackExhaustedError({
        originalProvider: provider,
        originalModel: resolvedModel,
        attempts,
        errors,
      }),
      provider: errors[errors.length - 1]?.provider || provider,
      model: errors[errors.length - 1]?.model || resolvedModel,
      errorCode: errors[errors.length - 1]?.errorCode,
      statusCode: errors[errors.length - 1]?.statusCode,
      fallbackUsed: attempts.length > 1,
      fallbackAttempts: attempts.length > 1 ? attempts.slice(1) : undefined,
      timing: { startMs, endMs, durationMs: endMs - startMs },
    };
  } catch (error: unknown) {
    const endMs = Date.now();
    if (isAbortError(error) || signal?.aborted) {
      return {
        ok: false,
        error: 'Request abgebrochen',
        provider,
        model: resolvedModel,
        timing: { startMs, endMs, durationMs: endMs - startMs },
      };
    }
    return {
      ok: false,
      error: `Orchestrator Fehler: ${getErrorMessage(error)}`,
      provider,
      model: resolvedModel,
      timing: { startMs, endMs, durationMs: endMs - startMs },
    };
  }
}
