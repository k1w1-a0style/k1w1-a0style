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

type CatalogExpectation = {
  id: string;
  label: string;
  pricePerMillion: string;
  codingStrength: number;
  description: string;
  availabilityLabel: string;
};

describe('AI model catalog source-of-truth', () => {
  const expectedCatalog: Record<AllAIProviders, CatalogExpectation[]> = {
    anthropic: [
      { id: 'claude-4-opus-202502', label: 'Opus 4.6', pricePerMillion: '$15 / $75', codingStrength: 5, description: 'Beste Reasoning, Architektur, lange Refactors, Tests', availabilityLabel: 'Ja' },
      { id: 'claude-4-sonnet-202502', label: 'Sonnet 4.6', pricePerMillion: '$3 / $15', codingStrength: 4, description: 'Sauberer Code, Multi-File, Tests, sehr zuverlässig', availabilityLabel: 'Ja' },
      { id: 'claude-4-haiku-202502', label: 'Haiku 4.5', pricePerMillion: '$0.30 / $1.50', codingStrength: 3, description: 'Schnell, kleine Fixes, Syntax, Boilerplate', availabilityLabel: 'Ja' },
      { id: 'claude-3.5-sonnet-202410', label: 'Sonnet 3.5', pricePerMillion: '$3 / $15', codingStrength: 4, description: 'Stabil, gutes Preis-Leistungs-Verhältnis', availabilityLabel: 'Ja' },
      { id: 'claude-3.5-haiku-202410', label: 'Haiku 3.5', pricePerMillion: '$0.30 / $1.50', codingStrength: 3, description: 'Sehr günstig & schnell', availabilityLabel: 'Ja' },
    ],
    openai: [
      { id: 'gpt-5.5-codex', label: 'GPT-5.5 Codex', pricePerMillion: '$20 / $60', codingStrength: 5, description: 'Agentic Coding, Tool-Use, komplexe Features', availabilityLabel: 'Ja' },
      { id: 'gpt-5.4-pro', label: 'GPT-5.4 Pro', pricePerMillion: '$15 / $45', codingStrength: 4, description: 'Große Repos, Architektur, Refactoring', availabilityLabel: 'Ja' },
      { id: 'gpt-5.4', label: 'GPT-5.4', pricePerMillion: '$10 / $30', codingStrength: 4, description: 'Solides Reasoning, Multi-File', availabilityLabel: 'Ja' },
      { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', pricePerMillion: '$0 (Quota)', codingStrength: 3, description: 'Schnell, Tests, Boilerplate', availabilityLabel: 'Ja' },
      { id: 'gpt-5.4-nano', label: 'GPT-5.4 nano', pricePerMillion: '$0 (Quota)', codingStrength: 2, description: 'Sehr leicht, Inline-Fixes', availabilityLabel: 'Ja' },
      { id: 'gpt-4o', label: 'GPT-4o', pricePerMillion: '$0 (Quota)', codingStrength: 4, description: 'Klassiker, ausgewogene Qualität', availabilityLabel: 'Ja' },
    ],
    gemini: [
      { id: 'gemini-3.1-pro', label: '3.1 Pro', pricePerMillion: '$10 / $35', codingStrength: 5, description: 'Beste Repo- & Kontext-Verständnis', availabilityLabel: 'Ja' },
      { id: 'gemini-2.5-pro', label: '2.5 Pro', pricePerMillion: '$7 / $25', codingStrength: 4, description: 'Starkes Reasoning, sauberer Code', availabilityLabel: 'Ja' },
      { id: 'gemini-3-flash', label: '3 Flash', pricePerMillion: '$0 (Quota)', codingStrength: 3, description: 'Sehr schnell, gute Syntax', availabilityLabel: 'Ja' },
      { id: 'gemini-2.5-flash', label: '2.5 Flash', pricePerMillion: '$0 (Quota)', codingStrength: 3, description: 'Schnell & zuverlässig', availabilityLabel: 'Ja' },
      { id: 'gemini-2.5-flash-lite', label: '2.5 Flash Lite', pricePerMillion: '$0 (Quota)', codingStrength: 2, description: 'Extrem leicht', availabilityLabel: 'Ja' },
    ],
    groq: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', pricePerMillion: '$2 / $8', codingStrength: 4, description: 'Beste Balance Speed/Qualität', availabilityLabel: 'Ja' },
      { id: 'llama-3.1-405b-reasoning', label: 'Llama 3.1 405B', pricePerMillion: '$5 / $15', codingStrength: 5, description: 'Höchste Qualität', availabilityLabel: 'Ja' },
      { id: 'grok-4', label: 'Grok 4', pricePerMillion: '$3 / $10', codingStrength: 4, description: 'Schnell, kreativ', availabilityLabel: 'Ja' },
      { id: 'llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout', pricePerMillion: '$0 (Limit)', codingStrength: 3, description: 'Neu & leicht', availabilityLabel: 'Ja' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', pricePerMillion: '$0 (Limit)', codingStrength: 2, description: 'Extrem schnell', availabilityLabel: 'Ja' },
      { id: 'qwen3-32b', label: 'Qwen 3 32B', pricePerMillion: '$0 (Limit)', codingStrength: 4, description: 'Sehr starkes Coding', availabilityLabel: 'Ja' },
      { id: 'mixtral-8x7b-instruct', label: 'Mixtral 8x7B', pricePerMillion: '$0 (Limit)', codingStrength: 3, description: 'Klassiker', availabilityLabel: 'Ja' },
      { id: 'gemma2-9b-it', label: 'Gemma 2 9B', pricePerMillion: '$0 (Limit)', codingStrength: 3, description: 'Schnell & effizient', availabilityLabel: 'Ja' },
    ],
    huggingface: [
      { id: 'Qwen/Qwen3-Coder-235B', label: 'Qwen 3 Coder', pricePerMillion: '$8 / $20', codingStrength: 5, description: 'Bestes Open-Source-Coding', availabilityLabel: 'Ja' },
      { id: 'deepseek-ai/DeepSeek-V3.2-Speciale', label: 'DeepSeek V3.2', pricePerMillion: '$7 / $18', codingStrength: 5, description: 'Starkes Reasoning', availabilityLabel: 'Ja' },
      { id: 'meta-llama/Llama-4-Maverick', label: 'Llama 4 Maverick', pricePerMillion: '$6 / $15', codingStrength: 4, description: 'Neu & leistungsstark', availabilityLabel: 'Ja' },
      { id: 'Qwen/Qwen3-32B', label: 'Qwen 3 32B', pricePerMillion: '$0 (Credits)', codingStrength: 4, description: 'Starkes Coding', availabilityLabel: 'Ja' },
      { id: 'Qwen/Qwen2.5-72B', label: 'Qwen 2.5 72B', pricePerMillion: '$0 (Credits)', codingStrength: 4, description: 'Solide 72B', availabilityLabel: 'Ja' },
      { id: 'deepseek-ai/DeepSeek-Coder-V2', label: 'DeepSeek Coder V2', pricePerMillion: '$0 (Credits)', codingStrength: 4, description: 'Sehr coding-orientiert', availabilityLabel: 'Ja' },
      { id: 'deepseek-ai/DeepSeek-R1-7B', label: 'DeepSeek R1 7B', pricePerMillion: '$0 (Credits)', codingStrength: 3, description: 'Schnell & leicht', availabilityLabel: 'Ja' },
      { id: 'meta-llama/Llama-3.3-70B', label: 'Llama 3.3 70B', pricePerMillion: '$0 (Credits)', codingStrength: 4, description: 'Gute Balance', availabilityLabel: 'Ja' },
      { id: 'microsoft/Phi-4-14B', label: 'Phi 4 14B', pricePerMillion: '$0 (Credits)', codingStrength: 3, description: 'Effizient & leicht', availabilityLabel: 'Ja' },
    ],
  };

  it('contains exact visible IDs + labels + pricing + coding + description + availability', () => {
    (Object.keys(expectedCatalog) as AllAIProviders[]).forEach((provider) => {
      const actual = AVAILABLE_MODELS[provider].map((model) => ({
        id: model.id,
        label: model.label,
        pricePerMillion: model.pricePerMillion,
        codingStrength: model.codingStrength,
        description: model.description,
        availabilityLabel: model.availabilityLabel,
      }));
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

  it('uses intended defaults per provider', () => {
    expect(PROVIDER_DEFAULTS).toEqual({
      groq: { speed: 'llama-3.1-8b-instant', quality: 'llama-3.3-70b-versatile' },
      gemini: { speed: 'gemini-2.5-flash-lite', quality: 'gemini-3.1-pro' },
      openai: { speed: 'gpt-5.4-mini', quality: 'gpt-5.4-pro' },
      anthropic: { speed: 'claude-4-haiku-202502', quality: 'claude-4-opus-202502' },
      huggingface: { speed: 'Qwen/Qwen3-32B', quality: 'Qwen/Qwen3-Coder-235B' },
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
