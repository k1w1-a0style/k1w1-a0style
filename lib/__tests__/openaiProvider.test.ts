import { callOpenAI } from '../orchestrator/providers/openai';
import type { LlmMessage } from '../orchestrator/types';

describe('callOpenAI payload hardening', () => {
  const originalFetch = global.fetch;

  const messages: LlmMessage[] = [
    { role: 'system', content: 'Du bist hilfreich.' },
    { role: 'user', content: 'Sag hallo.' },
  ];

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sends no unsupported verbosity field for non-reasoning models', async () => {
    const fetchMock = jest.fn<Promise<any>, [RequestInfo | URL, RequestInit?]>(async () => ({
      ok: true,
      json: async () => ({ output_text: 'Hallo!' }),
    }));

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await callOpenAI('test-key', 'gpt-4o-mini', messages, 'quality');

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(request.body));

    expect(body).not.toHaveProperty('verbosity');
    expect(body).toHaveProperty('temperature', 0.7);
    expect(body).toHaveProperty('max_output_tokens', 8192);
  });

  it('omits temperature for reasoning models to avoid 400s', async () => {
    const fetchMock = jest.fn<Promise<any>, [RequestInfo | URL, RequestInit?]>(async () => ({
      ok: true,
      json: async () => ({ output_text: 'Done' }),
    }));

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await callOpenAI('test-key', 'o3-mini', messages, 'speed');

    expect(result.ok).toBe(true);

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(request.body));

    expect(body).not.toHaveProperty('temperature');
    expect(body).toHaveProperty('max_output_tokens', 4096);
  });
});
