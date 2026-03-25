import { callGemini, callGroq } from '../supabase/functions/k1w1-handler/helpers.ts';

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

    const [calledUrl] = mockFetchWithTimeout.mock.calls[0];
    expect(String(calledUrl)).toContain('/models/gemini-2.5-flash:generateContent');
    expect(result.model).toBe('gemini-3-flash');
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
});
