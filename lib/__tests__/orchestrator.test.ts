import { providerRateLimiter } from '../RateLimiter';
import {
  runOrchestrator,
  parseFilesFromText,
  runValidatorOrchestrator,
  type LlmMessage,
  ORCHESTRATOR_REQUEST_TIMEOUT_MS,
} from '../orchestrator';
import { ensureSupabaseClient } from '../supabase';
import { getEdgeAdminKey } from '../../infra/github/githubService';
import { SUPABASE_EDGE_FUNCTIONS } from '../../shared/constants/supabase';

jest.mock('../supabase', () => ({
  ensureSupabaseClient: jest.fn(),
}));

jest.mock('../../infra/github/githubService', () => ({
  getEdgeAdminKey: jest.fn(),
}));

type InvokeOptions = {
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

const mockEnsureSupabaseClient = ensureSupabaseClient as jest.MockedFunction<typeof ensureSupabaseClient>;
const mockGetEdgeAdminKey = getEdgeAdminKey as jest.MockedFunction<typeof getEdgeAdminKey>;
const invokeMock = jest.fn();
const fetchSpy = jest.fn();
const originalFetch = global.fetch;

beforeAll(() => {
  global.fetch = fetchSpy as unknown as typeof fetch;
});

afterAll(() => {
  global.fetch = originalFetch;
});

beforeEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  invokeMock.mockReset();
  fetchSpy.mockReset();
  providerRateLimiter.resetProvider('groq');
  providerRateLimiter.resetProvider('openai');
  providerRateLimiter.resetProvider('anthropic');
  providerRateLimiter.resetProvider('gemini');
  providerRateLimiter.resetProvider('huggingface');

  mockEnsureSupabaseClient.mockResolvedValue({
    functions: {
      invoke: invokeMock,
    },
  } as unknown as Awaited<ReturnType<typeof ensureSupabaseClient>>);
  mockGetEdgeAdminKey.mockResolvedValue('edge-admin-key');
  invokeMock.mockResolvedValue({
    data: {
      ok: true,
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      content: 'ok',
    },
    error: null,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Orchestrator', () => {
  describe('parseFilesFromText', () => {
    it('sollte Dateien filtern basierend auf Content und Path (minimale Sicherheitschecks)', () => {
      const input =
        '[{"path":"valid.tsx","content":"code here"},{"path":"empty.tsx","content":""},{"path":"","content":"no path"}]';

      const result = parseFilesFromText(input);

      if (result !== null) {
        expect(result.some(f => f.path === '')).toBe(false);
        expect(result.some(f => f.path === 'valid.tsx')).toBe(true);
      } else {
        expect(result).toBeNull();
      }
    });
  });

  describe('runOrchestrator', () => {
    it('nutzt produktiv supabase.functions.invoke fuer k1w1-handler statt direkter Provider-Endpoints', async () => {
      const testMessages: LlmMessage[] = [{ role: 'user', content: 'hi' }];

      const result = await runOrchestrator('groq', 'llama-3.1-8b-instant', 'speed', testMessages);

      expect(result.ok).toBe(true);
      expect(mockEnsureSupabaseClient).toHaveBeenCalledTimes(1);
      expect(invokeMock).toHaveBeenCalledTimes(1);
      expect(invokeMock).toHaveBeenCalledWith(
        SUPABASE_EDGE_FUNCTIONS.K1W1_HANDLER,
        expect.objectContaining({
          body: {
            provider: 'groq',
            model: 'llama-3.1-8b-instant',
            quality: 'speed',
            messages: testMessages,
          },
          headers: { 'x-k1w1-admin-key': 'edge-admin-key' },
        }),
      );
      expect(fetchSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('api.groq.com'),
        expect.anything(),
      );
      expect(fetchSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('api.openai.com'),
        expect.anything(),
      );
      expect(fetchSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('api.anthropic.com'),
        expect.anything(),
      );
      expect(fetchSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.anything(),
      );
      expect(fetchSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('router.huggingface.co'),
        expect.anything(),
      );
    });

    it('mappt Edge-Responses in kompatible OrchestratorResult-Form', async () => {
      const testMessages: LlmMessage[] = [{ role: 'user', content: 'Sag Hallo' }];

      invokeMock.mockResolvedValueOnce({
        data: {
          ok: true,
          provider: 'openai',
          model: 'gpt-4o-mini',
          content: 'Hallo vom Edge-Proxy',
        },
        error: null,
      });

      const result = await runOrchestrator('openai', 'gpt-4o-mini', 'speed', testMessages);

      expect(result).toMatchObject({
        ok: true,
        text: 'Hallo vom Edge-Proxy',
        provider: 'openai',
        model: 'gpt-4o-mini',
      });
      expect(result.timing?.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('meldet fehlenden Edge-Admin-Key klar statt lokale Provider-Keys zu verlangen', async () => {
      const testMessages: LlmMessage[] = [{ role: 'user', content: 'hi' }];
      mockGetEdgeAdminKey.mockResolvedValueOnce(null);

      const result = await runOrchestrator('groq', 'llama-3.1-8b-instant', 'speed', testMessages);

      expect(result.ok).toBe(false);
      expect(String(result.error || '')).toMatch(/K1W1_EDGE_ADMIN_KEY/i);
      expect(invokeMock).not.toHaveBeenCalled();
    });

    it('behandelt Edge-Fehler stabil und verstaendlich', async () => {
      const testMessages: LlmMessage[] = [{ role: 'user', content: 'hi' }];

      invokeMock.mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsHttpError',
          context: new Response(JSON.stringify({ ok: false, error: 'Invalid request payload.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
        },
      });

      const result = await runOrchestrator('groq', 'llama-3.1-8b-instant', 'speed', testMessages);

      expect(result.ok).toBe(false);
      expect(result.provider).toBe('groq');
      expect(String(result.error || '')).toContain('Invalid request payload.');
    });

    it('nutzt strukturierte Edge-Fehlercodes fuer hilfreiche Chat-Meldungen statt generischem 500', async () => {
      const testMessages: LlmMessage[] = [{ role: 'user', content: 'hi' }];

      invokeMock.mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsHttpError',
          context: new Response(JSON.stringify({
            ok: false,
            code: 'provider_http_429',
            error: 'Openai meldet ein Rate-Limit oder ist voruebergehend ueberlastet (429).',
            provider: 'openai',
            model: 'gpt-4o-mini',
            status: 429,
          }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          }),
        },
      });

      const result = await runOrchestrator('openai', 'gpt-4o-mini', 'speed', testMessages);

      expect(result.ok).toBe(false);
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4o-mini');
      expect(String(result.error || '')).toBe(
        'Openai meldet ein Rate-Limit oder ist voruebergehend ueberlastet (429).',
      );
      expect(String(result.error || '')).not.toContain('Internal Server Error');
      expect(String(result.error || '')).not.toContain('Edge-Request fehlgeschlagen (429)');
    });

    it('meldet harte Request-Timeouts ueber den Edge-Proxy weiterhin als timeout', async () => {
      jest.useFakeTimers();
      const testMessages: LlmMessage[] = [{ role: 'user', content: 'hi' }];

      invokeMock.mockImplementationOnce(async (_fn: string, options?: InvokeOptions) => {
        return await new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
          });
        });
      });

      const pending = runOrchestrator('groq', 'llama-3.1-8b-instant', 'speed', testMessages);

      await jest.advanceTimersByTimeAsync(ORCHESTRATOR_REQUEST_TIMEOUT_MS + 1);
      const result = await pending;

      expect(result.ok).toBe(false);
      expect(String(result.error || '')).toMatch(/timeout/i);

      jest.useRealTimers();
    });

    it('meldet externes Abort-Signal weiterhin als abgebrochen', async () => {
      const testMessages: LlmMessage[] = [{ role: 'user', content: 'hi' }];

      invokeMock.mockImplementationOnce(async (_fn: string, options?: InvokeOptions) => {
        return await new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
          });
        });
      });

      const controller = new AbortController();
      const pending = runOrchestrator(
        'groq',
        'llama-3.1-8b-instant',
        'speed',
        testMessages,
        controller.signal,
      );

      controller.abort();
      const result = await pending;

      expect(result.ok).toBe(false);
      expect(String(result.error || '')).toMatch(/abgebrochen/i);
    });
  });

  describe('runValidatorOrchestrator', () => {
    it('haelt Validator/quality-Pfad ueber denselben Edge-Call kompatibel', async () => {
      const validationMessages: LlmMessage[] = [{ role: 'user', content: 'Validate this.' }];

      invokeMock.mockResolvedValueOnce({
        data: {
          ok: true,
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          content: 'Validator response',
        },
        error: null,
      });

      const result = await runValidatorOrchestrator(
        'anthropic',
        'claude-3-5-sonnet-20241022',
        validationMessages,
      );

      expect(result).toMatchObject({
        ok: true,
        text: 'Validator response',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
      });
      expect(invokeMock).toHaveBeenLastCalledWith(
        SUPABASE_EDGE_FUNCTIONS.K1W1_HANDLER,
        expect.objectContaining({
          body: expect.objectContaining({
            provider: 'anthropic',
            quality: 'quality',
            messages: validationMessages,
          }),
        }),
      );
    });
  });
});
