import { resolveRuntimeModelId } from '../shared/ai/modelRuntimeMap';

describe('model runtime mapping contracts', () => {
  it('maps anthropic visible IDs to explicit API-facing ids', () => {
    expect(resolveRuntimeModelId('anthropic', 'claude-4-opus-202502')).toMatchObject({
      visibleModel: 'claude-4-opus-202502',
      runtimeModel: 'claude-opus-4-20250514',
      status: 'mapped',
    });
  });

  it('maps gemini and groq aliases explicitly without changing visible ids', () => {
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
  });

  it('flags unknown IDs as unsupported instead of silently swapping defaults', () => {
    const unsupported = resolveRuntimeModelId('openai', 'non-existent-visible-id');
    expect(unsupported.status).toBe('unsupported');
    expect(unsupported.runtimeModel).toBe('non-existent-visible-id');
    expect(unsupported.note).toMatch(/nicht hinterlegt/i);
  });
});
