import { AVAILABLE_MODELS } from '../contexts/AIContext/models';
import { SHARED_PROVIDER_DEFAULTS } from '../shared/ai/providerDefaults';
import {
  PROVIDER_RUNTIME_MODEL_MAP,
  assertRuntimeModelSupported,
  resolveRuntimeModelId,
  type RuntimeProvider,
} from '../shared/ai/modelRuntimeMap';

describe('model runtime mapping contracts', () => {
  it('keeps runtime map frozen to prevent accidental runtime mutation', () => {
    expect(Object.isFrozen(PROVIDER_RUNTIME_MODEL_MAP)).toBe(true);
    for (const provider of Object.keys(PROVIDER_RUNTIME_MODEL_MAP) as RuntimeProvider[]) {
      expect(Object.isFrozen(PROVIDER_RUNTIME_MODEL_MAP[provider])).toBe(true);
    }
  });

  it('resolves mapped model ids explicitly and preserves visible id', () => {
    expect(resolveRuntimeModelId('anthropic', 'claude-4-opus-202502')).toMatchObject({
      visibleModel: 'claude-4-opus-202502',
      runtimeModel: 'claude-opus-4-20250514',
      status: 'mapped',
    });
    expect(resolveRuntimeModelId('gemini', 'gemini-3-flash')).toMatchObject({
      visibleModel: 'gemini-3-flash',
      runtimeModel: 'gemini-2.5-flash',
      status: 'mapped',
    });
    expect(resolveRuntimeModelId('groq', 'qwen3-32b')).toMatchObject({
      visibleModel: 'qwen3-32b',
      runtimeModel: 'qwen/qwen3-32b',
      status: 'mapped',
    });
    expect(resolveRuntimeModelId('huggingface', 'deepseek-ai/DeepSeek-V3.2')).toMatchObject({
      visibleModel: 'deepseek-ai/DeepSeek-V3.2',
      runtimeModel: 'deepseek-ai/DeepSeek-V3.2-Speciale',
      status: 'mapped',
    });
  });

  it('keeps direct model ids direct for openai path', () => {
    expect(resolveRuntimeModelId('openai', 'gpt-5.3-codex')).toMatchObject({
      visibleModel: 'gpt-5.3-codex',
      runtimeModel: 'gpt-5.3-codex',
      status: 'direct',
    });
  });

  it('rejects unsupported ids explicitly via assertion helper', () => {
    expect(() => assertRuntimeModelSupported('openai', 'non-existent-visible-id')).toThrow(
      /openai_model_unsupported/i,
    );
  });

  it('keeps every visible default model covered by runtime mapping', () => {
    for (const provider of Object.keys(SHARED_PROVIDER_DEFAULTS) as RuntimeProvider[]) {
      const defaults = SHARED_PROVIDER_DEFAULTS[provider];
      expect(assertRuntimeModelSupported(provider, defaults.speed).status).not.toBe('unsupported');
      expect(assertRuntimeModelSupported(provider, defaults.quality).status).not.toBe('unsupported');
    }
  });

  it('keeps every mapped model in visible catalog for each provider', () => {
    for (const provider of Object.keys(AVAILABLE_MODELS) as RuntimeProvider[]) {
      const visibleIds = new Set(AVAILABLE_MODELS[provider].map((entry) => entry.id));
      for (const mappedVisibleId of Object.keys(PROVIDER_RUNTIME_MODEL_MAP[provider])) {
        expect(visibleIds.has(mappedVisibleId)).toBe(true);
      }
    }
  });
});
