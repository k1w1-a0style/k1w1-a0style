// lib/orchestrator/index.ts
// REFACTORED: providers split into individual files, helpers & types extracted.

import { providerRateLimiter } from '../RateLimiter';
import SecureKeyManager from '../SecureKeyManager';
import { AllAIProviders } from '../../contexts/AIContext';
import { normalizeAiResponse } from '../normalizer';

import type { LlmMessage, OrchestratorResult, Quality } from './types';
import { resolveModel } from './helpers';

import { callGroq } from './providers/groq';
import { callOpenAI } from './providers/openai';
import { callAnthropic } from './providers/anthropic';
import { callGemini } from './providers/gemini';
import { callHuggingFace } from './providers/huggingface';

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

async function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  if (signal?.aborted) {
    throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    };

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
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
  const hardDeadlineMs = startMs + ORCHESTRATOR_REQUEST_TIMEOUT_MS;
  const resolvedModel = resolveModel(provider, model, quality);
  let keysRotated = 0;

  try {
    await providerRateLimiter.checkLimit(provider);

    const isRateLimit = (r: OrchestratorResult): boolean => {
      const parts: string[] = [];
      if (typeof r.error === 'string') parts.push(r.error);
      if (Array.isArray(r.errors)) parts.push(...r.errors);
      const s = parts.join('\n').toLowerCase();

      if (s.includes('too many requests')) return true;
      if (s.includes('rate limit')) return true;
      if (s.includes('resource_exhausted')) return true;
      if (s.includes('quota')) return true;
      if (s.includes('(429)')) return true;
      if (/(^|[^0-9])429([^0-9]|$)/.test(s)) return true;
      return false;
    };

    const maxRotations = 2;
    let lastResult: OrchestratorResult = {
      ok: false,
      error: `Kein API-Key für ${provider} gefunden. Bitte in Einstellungen konfigurieren.`,
      model: resolvedModel,
    };

    for (let attempt = 0; attempt <= maxRotations; attempt++) {
      const remainingMs = hardDeadlineMs - Date.now();
      if (remainingMs <= 0) {
        const endMs = Date.now();
        return {
          ok: false,
          error: `Request timeout nach ${ORCHESTRATOR_REQUEST_TIMEOUT_MS}ms`,
          provider,
          model: resolvedModel,
          keysRotated: keysRotated || undefined,
          timing: { startMs, endMs, durationMs: endMs - startMs },
        };
      }

      if (signal?.aborted) {
        const endMs = Date.now();
        return {
          ok: false, error: "Request abgebrochen", provider, model: resolvedModel,
          keysRotated: keysRotated || undefined,
          timing: { startMs, endMs, durationMs: endMs - startMs },
        };
      }

      const apiKey = SecureKeyManager.getCurrentKey(provider);
      if (!apiKey) break;

      const requestController = new AbortController();
      let timeoutTriggered = false;
      const timeoutId = setTimeout(() => {
        timeoutTriggered = true;
        requestController.abort();
      }, remainingMs);
      const onAbort = () => requestController.abort();
      signal?.addEventListener('abort', onAbort, { once: true });

      let result: OrchestratorResult;
      try {
        switch (provider) {
          case 'groq':       result = await callGroq(apiKey, resolvedModel, messages, quality, requestController.signal); break;
          case 'openai':     result = await callOpenAI(apiKey, resolvedModel, messages, quality, requestController.signal); break;
          case 'anthropic':  result = await callAnthropic(apiKey, resolvedModel, messages, quality, requestController.signal); break;
          case 'gemini':     result = await callGemini(apiKey, resolvedModel, messages, quality, requestController.signal); break;
          case 'huggingface': result = await callHuggingFace(apiKey, resolvedModel, messages, quality, requestController.signal); break;
          default:           result = { ok: false, error: `Unbekannter Provider: ${provider}` };
        }
      } finally {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', onAbort);
      }

      if (timeoutTriggered) {
        const endMs = Date.now();
        return {
          ok: false,
          error: `Request timeout nach ${ORCHESTRATOR_REQUEST_TIMEOUT_MS}ms`,
          provider,
          model: resolvedModel,
          keysRotated: keysRotated || undefined,
          timing: { startMs, endMs, durationMs: endMs - startMs },
        };
      }

      lastResult = result;
      if (result.ok) break;
      if (isRateLimit(result) && SecureKeyManager.rotateKey(provider)) {
        keysRotated += 1;
        await sleepWithAbort(ORCHESTRATOR_ROTATION_BACKOFF_MS, signal);
        continue;
      }
      break;
    }

    const endMs = Date.now();
    return {
      ...lastResult, provider, model: resolvedModel,
      keysRotated: keysRotated || undefined,
      timing: { startMs, endMs, durationMs: endMs - startMs },
    };
  } catch (error: unknown) {
    const endMs = Date.now();
    if (isAbortError(error) || signal?.aborted) {
      return {
        ok: false, error: "Request abgebrochen", provider, model: resolvedModel,
        keysRotated: keysRotated || undefined,
        timing: { startMs, endMs, durationMs: endMs - startMs },
      };
    }
    return {
      ok: false, error: `Orchestrator Fehler: ${getErrorMessage(error)}`,
      provider, model: resolvedModel,
      keysRotated: keysRotated || undefined,
      timing: { startMs, endMs, durationMs: endMs - startMs },
    };
  }
}
