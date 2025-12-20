// lib/tokenEstimator.ts
// Deterministic heuristic token estimation (unit-test aligned).

import type { AllAIProviders } from '../contexts/AIContext';

type ProviderLike = AllAIProviders | string | undefined | null;

function charsPerToken(provider?: ProviderLike): number {
  const p = String(provider ?? '').toLowerCase();

  // Provider-specific heuristics used by tests
  if (p.includes('openai')) return 3.8;
  if (p.includes('anthropic') || p.includes('claude')) return 3.5;
  if (p.includes('groq')) return 4.5;
  if (p.includes('gemini')) return 4.0;
  if (p.includes('huggingface') || p === 'hf') return 4.0;

  // ✅ Default expected by tests: 4 chars/token
  return 4.0;
}

export function estimateTokens(text: string, provider?: ProviderLike): number {
  const s = String(text ?? '');
  if (s.length === 0) return 0;

  const ratio = charsPerToken(provider);
  return Math.ceil(s.length / ratio);
}

export function estimateTokensForArray(items: string[], provider?: ProviderLike): number {
  if (!Array.isArray(items) || items.length === 0) return 0;

  return items.reduce<number>((sum, it) => {
    return sum + estimateTokens(String(it ?? ''), provider);
  }, 0);
}

export function exceedsTokenLimit(text: string, limit = 8192, provider?: ProviderLike): boolean {
  const lim = Number(limit);
  if (!Number.isFinite(lim)) return false;

  // ✅ Tests expect: limit=0 => true for any non-empty text (tokens > 0)
  return estimateTokens(text, provider) > lim;
}
