/**
 * @jest-environment node
 */

import {
  PROVIDER_DEFAULTS,
  AVAILABLE_MODELS,
  type AllAIProviders,
} from '../../contexts/AIContext';
import { SHARED_PROVIDER_DEFAULTS } from '../../shared/ai/providerDefaults';
import { resolveRuntimeModelId } from '../../shared/ai/modelRuntimeMap';
import { resolveModel } from '../orchestrator/helpers';

describe('AI model catalog source-of-truth', () => {
  const expectedCatalog: Record<AllAIProviders, string[]> = {
    anthropic: [
      'claude-4-opus-202502',
      'claude-4-sonnet-202502',
      'claude-4-haiku-202502',
      'claude-3.5-sonnet-202410',
      'claude-3.5-haiku-202410',
    ],
    openai: [
      'gpt-5.5-codex',
      'gpt-5.4-pro',
      'gpt-5.4',
      'gpt-5.4-mini',
      'gpt-5.4-nano',
      'gpt-4o',
    ],
    gemini: [
      'gemini-3.1-pro',
      'gemini-2.5-pro',
      'gemini-3-flash',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ],
    groq: [
      'llama-3.3-70b-versatile',
      'llama-3.1-405b-reasoning',
      'grok-4',
      'llama-4-scout-17b-16e-instruct',
      'llama-3.1-8b-instant',
      'qwen3-32b',
      'mixtral-8x7b-instruct',
      'gemma2-9b-it',
    ],
    huggingface: [
      'Qwen/Qwen3-Coder-235B',
      'deepseek-ai/DeepSeek-V3.2-Speciale',
      'meta-llama/Llama-4-Maverick',
      'Qwen/Qwen3-32B',
      'Qwen/Qwen2.5-72B',
      'deepseek-ai/DeepSeek-Coder-V2',
      'deepseek-ai/DeepSeek-R1-7B',
      'meta-llama/Llama-3.3-70B',
      'microsoft/Phi-4-14B',
    ],
  };

  it('contains exactly the requested visible model IDs per provider', () => {
    (Object.keys(expectedCatalog) as AllAIProviders[]).forEach((provider) => {
      const actual = AVAILABLE_MODELS[provider].map((model) => model.id);
      expect(actual).toEqual(expectedCatalog[provider]);
    });
  });

  it('keeps shared defaults aligned between app and runtime', () => {
    expect(PROVIDER_DEFAULTS).toEqual(SHARED_PROVIDER_DEFAULTS);
  });

  it('keeps defaults inside the visible catalog', () => {
    (Object.keys(PROVIDER_DEFAULTS) as AllAIProviders[]).forEach((provider) => {
      const ids = AVAILABLE_MODELS[provider].map((entry) => entry.id);
      expect(ids).toContain(PROVIDER_DEFAULTS[provider].speed);
      expect(ids).toContain(PROVIDER_DEFAULTS[provider].quality);
    });
  });

  it('maps quality/review to quality defaults and speed/balanced to speed defaults', () => {
    (Object.keys(PROVIDER_DEFAULTS) as AllAIProviders[]).forEach((provider) => {
      expect(resolveModel(provider, 'auto', 'speed')).toBe(PROVIDER_DEFAULTS[provider].speed);
      expect(resolveModel(provider, 'auto', 'balanced')).toBe(PROVIDER_DEFAULTS[provider].speed);
      expect(resolveModel(provider, 'auto', 'quality')).toBe(PROVIDER_DEFAULTS[provider].quality);
      expect(resolveModel(provider, 'auto', 'review')).toBe(PROVIDER_DEFAULTS[provider].quality);
    });
  });

  it('keeps explicit runtime mapping available while preserving visible IDs', () => {
    const anth = resolveRuntimeModelId('anthropic', 'claude-4-opus-202502');
    expect(anth.visibleModel).toBe('claude-4-opus-202502');
    expect(anth.runtimeModel).toBe('claude-opus-4-20250514');
    expect(anth.status).toBe('mapped');

    const gemini = resolveRuntimeModelId('gemini', 'gemini-3-flash');
    expect(gemini.visibleModel).toBe('gemini-3-flash');
    expect(gemini.runtimeModel).toBe('gemini-2.5-flash');
    expect(gemini.status).toBe('mapped');

    const groq = resolveRuntimeModelId('groq', 'qwen3-32b');
    expect(groq.visibleModel).toBe('qwen3-32b');
    expect(groq.runtimeModel).toBe('qwen/qwen3-32b');
    expect(groq.status).toBe('mapped');
  });
});
