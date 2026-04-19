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
