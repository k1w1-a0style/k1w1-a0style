// lib/orchestrator/index.ts
// REFACTORED: providers split into individual files, helpers & types extracted.

import { providerRateLimiter } from '../RateLimiter';
import { AllAIProviders, PROVIDER_DEFAULTS } from '../../contexts/AIContext';
import { normalizeAiResponse } from '../normalizer';

import type { LlmMessage, OrchestratorResult, Quality } from './types';
import { resolveModel } from './helpers';
import { invokeK1w1Handler } from './k1w1Edge';

export const ORCHESTRATOR_REQUEST_TIMEOUT_MS = 45_000;
export const ORCHESTRATOR_ROTATION_BACKOFF_MS = 350;

const PROVIDER_FALLBACK_ORDER: AllAIProviders[] = [
  'openai',
  'anthropic',
  'groq',
  'gemini',
  'huggingface',
];

const FALLBACK_ELIGIBLE_ERROR_CODES = new Set([
  'provider_env_missing',
  'provider_model_not_found',
  'unsupported_provider',
  'provider_http_401',
  'provider_http_403',
]);

// Re-export types so existing imports keep working
export type { LlmMessage, OrchestratorResult } from './types';

function isAbortError(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'name' in error && (error as { name?: unknown }).name === 'AbortError';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function formatFallbackNote(kind: 'same_provider' | 'cross_provider', params: {
  fromProvider: string;
  fromModel: string;
  toProvider: string;
  toModel: string;
  reason: string;
}): string {
  const fromLabel = `${params.fromProvider}/${params.fromModel}`;
  const toLabel = `${params.toProvider}/${params.toModel}`;
  if (kind === 'same_provider') {
    return `⚠️ Modell-Fallback aktiv: ${fromLabel} war nicht verfügbar (${params.reason}). Verwende stattdessen ${toLabel}.`;
  }
  return `⚠️ Provider-Fallback aktiv: ${fromLabel} war nicht verfügbar (${params.reason}). Verwende stattdessen ${toLabel}.`;
}

function buildFallbackCandidates(
  provider: AllAIProviders,
  model: string,
  quality: Quality,
  errorCode?: string,
): Array<{ provider: AllAIProviders; model: string; kind: 'same_provider' | 'cross_provider' }> {
  const candidates: Array<{ provider: AllAIProviders; model: string; kind: 'same_provider' | 'cross_provider' }> = [];
  const seen = new Set<string>([`${provider}::${model}`]);

  if (errorCode === 'provider_model_not_found') {
    const sameProviderFallback = resolveModel(provider, 'auto', quality);
    const sameKey = `${provider}::${sameProviderFallback}`;
    if (sameProviderFallback && !seen.has(sameKey)) {
      candidates.push({ provider, model: sameProviderFallback, kind: 'same_provider' });
      seen.add(sameKey);
    }
  }

  for (const candidateProvider of PROVIDER_FALLBACK_ORDER) {
    if (candidateProvider === provider) continue;
    const candidateModel = PROVIDER_DEFAULTS[candidateProvider][quality === 'quality' || quality === 'review' ? 'quality' : 'speed'];
    const key = `${candidateProvider}::${candidateModel}`;
    if (candidateModel && !seen.has(key)) {
      candidates.push({ provider: candidateProvider, model: candidateModel, kind: 'cross_provider' });
      seen.add(key);
    }
  }

  return candidates;
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
    await providerRateLimiter.checkLimit(provider);

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

    const result = await invokeK1w1Handler({
      provider,
      model: resolvedModel,
      quality,
      messages,
      signal,
      timeoutMs: ORCHESTRATOR_REQUEST_TIMEOUT_MS,
    });

    const primaryResult = result;

    if (primaryResult.ok || !FALLBACK_ELIGIBLE_ERROR_CODES.has(String(primaryResult.errorCode || ''))) {
      const endMs = Date.now();
      return {
        ...primaryResult,
        provider: primaryResult.provider || provider,
        model: primaryResult.model || resolvedModel,
        timing: { startMs, endMs, durationMs: endMs - startMs },
      };
    }

    const fallbackCandidates = buildFallbackCandidates(
      provider,
      primaryResult.model || resolvedModel,
      quality,
      primaryResult.errorCode,
    );

    const notes = [
      `${primaryResult.provider || provider}/${primaryResult.model || resolvedModel}: ${primaryResult.error || 'Unbekannter Fehler.'}`,
    ];

    for (const candidate of fallbackCandidates) {
      if (signal?.aborted) break;
      await providerRateLimiter.checkLimit(candidate.provider);

      const fallbackResult = await invokeK1w1Handler({
        provider: candidate.provider,
        model: candidate.model,
        quality,
        messages,
        signal,
        timeoutMs: ORCHESTRATOR_REQUEST_TIMEOUT_MS,
      });

      if (fallbackResult.ok) {
        notes.unshift(
          formatFallbackNote(candidate.kind, {
            fromProvider: primaryResult.provider || provider,
            fromModel: primaryResult.model || resolvedModel,
            toProvider: fallbackResult.provider || candidate.provider,
            toModel: fallbackResult.model || candidate.model,
            reason: primaryResult.error || 'unbekannter Fehler',
          }),
        );

        const endMs = Date.now();
        return {
          ...fallbackResult,
          provider: fallbackResult.provider || candidate.provider,
          model: fallbackResult.model || candidate.model,
          errors: notes,
          timing: { startMs, endMs, durationMs: endMs - startMs },
        };
      }

      notes.push(
        `${fallbackResult.provider || candidate.provider}/${fallbackResult.model || candidate.model}: ${fallbackResult.error || 'Unbekannter Fehler.'}`,
      );
    }

    const endMs = Date.now();
    return {
      ...primaryResult,
      provider: primaryResult.provider || provider,
      model: primaryResult.model || resolvedModel,
      errors: notes,
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
