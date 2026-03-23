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

    const endMs = Date.now();
    return {
      ...result,
      provider: result.provider || provider,
      model: result.model || resolvedModel,
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
