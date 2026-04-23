import { callAnthropic, callGemini, callGroq, callHuggingFace, callOpenAI } from '../supabase/functions/k1w1-handler/helpers.ts';

const mockGetRuntimeEnv = jest.fn();
const mockFetchWithTimeout = jest.fn();

jest.mock('../supabase/functions/_shared/auth.ts', () => ({
  getRuntimeEnv: (...args: unknown[]) => mockGetRuntimeEnv(...args),
}));

jest.mock('../supabase/functions/_shared/fetchWithTimeout.ts', () => ({
  fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
}));

describe('k1w1-handler runtime mapping behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRuntimeEnv.mockImplementation((key: string) => {
      if (key.endsWith('_API_KEY')) return 'test-key';
      return null;
    });
  });

  it('uses mapped runtime id for Gemini upstream call while returning visible id + runtime note', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'hello' }] } }],
      }),
    });

    const result = await callGemini({
      provider: 'gemini',
      model: 'gemini-3-flash',
      quality: 'balanced',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    const [calledUrl, request] = mockFetchWithTimeout.mock.calls[0];
    expect(String(calledUrl)).toContain('/models/gemini-2.5-flash:generateContent');
    expect(String(calledUrl)).not.toContain('?key=');
    expect(request.headers["x-goog-api-key"]).toBe('test-key');
    expect(result.model).toBe('gemini-3-flash');
    expect(String(result.runtimeNote || '')).toContain('Runtime-Mapping aktiv');
  });

  it('maps gemini-3.1-flash-lite to runtime alias while keeping visible model', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'hello-lite' }] } }],
      }),
    });

    const result = await callGemini({
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite',
      quality: 'speed',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    const [calledUrl, request] = mockFetchWithTimeout.mock.calls[0];
    expect(String(calledUrl)).toContain('/models/gemini-2.5-flash-lite:generateContent');
    expect(String(calledUrl)).not.toContain('?key=');
    expect(request.headers["x-goog-api-key"]).toBe('test-key');
    expect(result.model).toBe('gemini-3.1-flash-lite');
    expect(String(result.runtimeNote || '')).toContain('Runtime-Mapping aktiv');
  });

  it('uses mapped runtime id for Groq upstream call while keeping visible id in response', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
      }),
    });

    const result = await callGroq({
      provider: 'groq',
      model: 'qwen3-32b',
      quality: 'balanced',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    const [, request] = mockFetchWithTimeout.mock.calls[0];
    const body = JSON.parse(String(request.body));
    expect(body.model).toBe('qwen/qwen3-32b');
    expect(result.model).toBe('qwen3-32b');
    expect(String(result.runtimeNote || '')).toContain('Runtime-Mapping aktiv');
  });

  it('maps llama-4-scout-17b-16e to runtime scout instruct id without changing visible id', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
      }),
    });

    const result = await callGroq({
      provider: 'groq',
      model: 'llama-4-scout-17b-16e',
      quality: 'balanced',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    const [, request] = mockFetchWithTimeout.mock.calls[0];
    const body = JSON.parse(String(request.body));
    expect(body.model).toBe('llama-4-scout-17b-16e-instruct');
    expect(result.model).toBe('llama-4-scout-17b-16e');
    expect(String(result.runtimeNote || '')).toContain('Runtime-Mapping aktiv');
  });

  it('maps Hugging Face visible deepseek id to runtime alias while preserving visible model', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ generated_text: 'hf' }],
    });

    const result = await callHuggingFace({
      provider: 'huggingface',
      model: 'deepseek-ai/DeepSeek-V3.2',
      quality: 'quality',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    const [calledUrl] = mockFetchWithTimeout.mock.calls[0];
    expect(String(calledUrl)).toContain('deepseek-ai%2FDeepSeek-V3.2-Speciale');
    expect(result.model).toBe('deepseek-ai/DeepSeek-V3.2');
    expect(String(result.runtimeNote || '')).toContain('Runtime-Mapping aktiv');
  });


  it('maps anthropic alias upstream while preserving visible model + runtime note', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'anthropic-ok' }],
      }),
    });

    const result = await callAnthropic({
      provider: 'anthropic',
      model: 'claude-4-opus-202502',
      quality: 'quality',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    const [, request] = mockFetchWithTimeout.mock.calls[0];
    const body = JSON.parse(String(request.body));
    expect(body.model).toBe('claude-opus-4-20250514');
    expect(result.model).toBe('claude-4-opus-202502');
    expect(String(result.runtimeNote || '')).toContain('Runtime-Mapping aktiv');
  });

  it('keeps openai direct IDs upstream without runtime mapping note', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'openai-ok' } }],
      }),
    });

    const result = await callOpenAI({
      provider: 'openai',
      model: 'gpt-5.3-codex',
      quality: 'balanced',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    const [, request] = mockFetchWithTimeout.mock.calls[0];
    const body = JSON.parse(String(request.body));
    expect(body.model).toBe('gpt-5.3-codex');
    expect(result.model).toBe('gpt-5.3-codex');
    expect(result.runtimeNote).toBeUndefined();
  });



  it('retries Groq once with provider-prefix fallback only for model-not-found style 404 responses', async () => {
    mockFetchWithTimeout
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({
          error: {
            code: 'model_not_found',
            message: 'The model `qwen/qwen3-32b` does not exist',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'ok-after-fallback' } }],
        }),
      });

    const result = await callGroq({
      provider: 'groq',
      model: 'qwen3-32b',
      quality: 'balanced',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String(mockFetchWithTimeout.mock.calls[0][1].body));
    const secondBody = JSON.parse(String(mockFetchWithTimeout.mock.calls[1][1].body));
    expect(firstBody.model).toBe('qwen/qwen3-32b');
    expect(secondBody.model).toBe('qwen3-32b');
    expect(result.content).toBe('ok-after-fallback');
  });

  it('does not retry Groq fallback for broad 404 texts that merely mention model', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'Rate-limit bucket for this model is exhausted; retry later.',
    });

    await expect(
      callGroq({
        provider: 'groq',
        model: 'qwen3-32b',
        quality: 'balanced',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    ).rejects.toThrow(/groq_http_404 \(model=qwen\/qwen3-32b\)/i);

    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
  });

  it('does not retry Groq fallback for 404 text that only contains "the model" without not-found semantics', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'The model quota window is currently exhausted for this account.',
    });

    await expect(
      callGroq({
        provider: 'groq',
        model: 'qwen3-32b',
        quality: 'balanced',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    ).rejects.toThrow(/groq_http_404 \(model=qwen\/qwen3-32b\)/i);

    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported visible IDs explicitly instead of silently falling back', async () => {
    await expect(
      callGemini({
        provider: 'gemini',
        model: 'gemini-legacy-not-supported',
        quality: 'balanced',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    ).rejects.toThrow(/gemini_model_unsupported/i);

    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });
});
