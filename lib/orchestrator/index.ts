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

// Re-export types so existing imports keep working
export type { LlmMessage, OrchestratorResult } from './types';

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

      let result: OrchestratorResult;
      switch (provider) {
        case 'groq':       result = await callGroq(apiKey, resolvedModel, messages, quality, signal); break;
        case 'openai':     result = await callOpenAI(apiKey, resolvedModel, messages, quality, signal); break;
        case 'anthropic':  result = await callAnthropic(apiKey, resolvedModel, messages, quality, signal); break;
        case 'gemini':     result = await callGemini(apiKey, resolvedModel, messages, quality, signal); break;
        case 'huggingface': result = await callHuggingFace(apiKey, resolvedModel, messages, quality, signal); break;
        default:           result = { ok: false, error: `Unbekannter Provider: ${provider}` };
      }

      lastResult = result;
      if (result.ok) break;
      if (isRateLimit(result) && SecureKeyManager.rotateKey(provider)) { keysRotated += 1; continue; }
      break;
    }

    const endMs = Date.now();
    return {
      ...lastResult, provider, model: resolvedModel,
      keysRotated: keysRotated || undefined,
      timing: { startMs, endMs, durationMs: endMs - startMs },
    };
  } catch (error: any) {
    const endMs = Date.now();
    if (error?.name === "AbortError" || signal?.aborted) {
      return {
        ok: false, error: "Request abgebrochen", provider, model: resolvedModel,
        keysRotated: keysRotated || undefined,
        timing: { startMs, endMs, durationMs: endMs - startMs },
      };
    }
    return {
      ok: false, error: `Orchestrator Fehler: ${error?.message ?? String(error)}`,
      provider, model: resolvedModel,
      keysRotated: keysRotated || undefined,
      timing: { startMs, endMs, durationMs: endMs - startMs },
    };
  }
}
