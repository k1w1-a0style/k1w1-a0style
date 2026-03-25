import { AVAILABLE_MODELS, PROVIDER_DEFAULTS, type AllAIProviders, type QualityMode } from '../contexts/AIContext/models';
import { getModeKeyForQualityMode, resolveProviderModeForQualityMode } from '../contexts/AIContext/helpers';
import { SHARED_PROVIDER_DEFAULTS } from '../shared/ai/providerDefaults';
import { assertRuntimeModelSupported } from '../shared/ai/modelRuntimeMap';

const PROVIDERS: AllAIProviders[] = ['groq', 'gemini', 'openai', 'anthropic', 'huggingface'];

describe('k1w1 runtime/provider invariants', () => {
  it('keeps app defaults and shared runtime defaults aligned', () => {
    expect(PROVIDER_DEFAULTS).toEqual(SHARED_PROVIDER_DEFAULTS);
  });

  it('keeps all defaults in visible catalog and runtime mapping contract', () => {
    for (const provider of PROVIDERS) {
      const visibleIds = new Set(AVAILABLE_MODELS[provider].map((entry) => entry.id));
      const defaults = SHARED_PROVIDER_DEFAULTS[provider];

      expect(visibleIds.has(defaults.speed)).toBe(true);
      expect(visibleIds.has(defaults.quality)).toBe(true);
      expect(assertRuntimeModelSupported(provider, defaults.speed).status).not.toBe('unsupported');
      expect(assertRuntimeModelSupported(provider, defaults.quality).status).not.toBe('unsupported');
    }
  });

  it('keeps quality routing invariant: speed/balanced => speed, quality/review => quality', () => {
    const modeCases: Array<{ qualityMode: QualityMode; expectedKey: 'speed' | 'quality' }> = [
      { qualityMode: 'speed', expectedKey: 'speed' },
      { qualityMode: 'balanced', expectedKey: 'speed' },
      { qualityMode: 'quality', expectedKey: 'quality' },
      { qualityMode: 'review', expectedKey: 'quality' },
    ];

    for (const provider of PROVIDERS) {
      for (const testCase of modeCases) {
        expect(getModeKeyForQualityMode(testCase.qualityMode)).toBe(testCase.expectedKey);
        expect(resolveProviderModeForQualityMode(provider, testCase.qualityMode)).toBe(
          SHARED_PROVIDER_DEFAULTS[provider][testCase.expectedKey],
        );
      }
    }
  });

  it('guards against silent fallback to unrelated historical defaults', () => {
    expect(SHARED_PROVIDER_DEFAULTS.groq.speed).toBe('llama-3.1-8b-instant');
    expect(SHARED_PROVIDER_DEFAULTS.groq.quality).toBe('llama-3.3-70b-versatile');
    expect(SHARED_PROVIDER_DEFAULTS.gemini.speed).toBe('gemini-3.1-flash-lite');
    expect(SHARED_PROVIDER_DEFAULTS.gemini.quality).toBe('gemini-3.1-pro');
    expect(SHARED_PROVIDER_DEFAULTS.openai.speed).toBe('gpt-5.4-mini');
    expect(SHARED_PROVIDER_DEFAULTS.openai.quality).toBe('gpt-5.4-pro');
    expect(SHARED_PROVIDER_DEFAULTS.anthropic.speed).toBe('claude-4-haiku-202502');
    expect(SHARED_PROVIDER_DEFAULTS.anthropic.quality).toBe('claude-4-opus-202502');
    expect(SHARED_PROVIDER_DEFAULTS.huggingface.speed).toBe('Qwen/Qwen3-32B');
    expect(SHARED_PROVIDER_DEFAULTS.huggingface.quality).toBe('Qwen/Qwen3-Coder-235B');
  });
});
