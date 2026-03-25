import { resolveRuntimeModelId } from '../shared/ai/modelRuntimeMap';

describe('model runtime mapping contracts', () => {
  it('maps anthropic visible IDs to explicit API-facing ids', () => {
    expect(resolveRuntimeModelId('anthropic', 'claude-4-opus-202502')).toMatchObject({
      visibleModel: 'claude-4-opus-202502',
      runtimeModel: 'claude-opus-4-20250514',
      status: 'mapped',
    });
  });

  it('keeps updated openai codex id as direct runtime id', () => {
    expect(resolveRuntimeModelId('openai', 'gpt-5.3-codex')).toMatchObject({
      visibleModel: 'gpt-5.3-codex',
      runtimeModel: 'gpt-5.3-codex',
      status: 'direct',
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

    expect(resolveRuntimeModelId('gemini', 'gemini-3.1-flash-lite')).toMatchObject({
      visibleModel: 'gemini-3.1-flash-lite',
      runtimeModel: 'gemini-2.5-flash-lite',
      status: 'mapped',
    });

    expect(resolveRuntimeModelId('groq', 'llama-4-scout-17b-16e')).toMatchObject({
      visibleModel: 'llama-4-scout-17b-16e',
      runtimeModel: 'llama-4-scout-17b-16e-instruct',
      status: 'mapped',
    });

    expect(resolveRuntimeModelId('huggingface', 'deepseek-ai/DeepSeek-V3.2')).toMatchObject({
      visibleModel: 'deepseek-ai/DeepSeek-V3.2',
      runtimeModel: 'deepseek-ai/DeepSeek-V3.2-Speciale',
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
