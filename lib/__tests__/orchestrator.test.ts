import { providerRateLimiter } from '../RateLimiter';
import {
  runOrchestrator,
  parseFilesFromText,
  runValidatorOrchestrator,
  type LlmMessage,
  ORCHESTRATOR_REQUEST_TIMEOUT_MS,
} from '../orchestrator';
import { ensureSupabaseClient } from '../supabase';
import { getLegacyEdgeAdminKey } from '../../infra/github/githubService';
import { SUPABASE_EDGE_FUNCTIONS } from '../../shared/constants/supabase';

jest.mock('../supabase', () => ({
  ensureSupabaseClient: jest.fn(),
}));

jest.mock('../../infra/github/githubService', () => ({
  getLegacyEdgeAdminKey: jest.fn(),
}));

type InvokeOptions = {
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

const mockEnsureSupabaseClient = ensureSupabaseClient as jest.MockedFunction<typeof ensureSupabaseClient>;
const mockGetEdgeAdminKey = getLegacyEdgeAdminKey as jest.MockedFunction<typeof getLegacyEdgeAdminKey>;
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
          model: 'gpt-5.4-mini',
          content: 'Hallo vom Edge-Proxy',
        },
        error: null,
      });

      const result = await runOrchestrator('openai', 'gpt-5.4-mini', 'speed', testMessages);

      expect(result).toMatchObject({
        ok: true,
        text: 'Hallo vom Edge-Proxy',
        provider: 'openai',
        model: 'gpt-5.4-mini',
      });
      expect(result.timing?.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('reicht runtime mapping notes als sichtbare runtimeNote durch', async () => {
      const testMessages: LlmMessage[] = [{ role: 'user', content: 'Sag Hallo' }];

      invokeMock.mockResolvedValueOnce({
        data: {
          ok: true,
          provider: 'groq',
          model: 'qwen3-32b',
          content: 'Hallo vom Edge-Proxy',
          runtime_note: 'ℹ️ Runtime-Mapping aktiv: groq/qwen3-32b -> groq/qwen/qwen3-32b (alias).',
        },
        error: null,
      });

      const result = await runOrchestrator('groq', 'qwen3-32b', 'balanced', testMessages);
      expect(result.ok).toBe(true);
      expect(result.model).toBe('qwen3-32b');
      expect(result.runtimeNote).toContain('Runtime-Mapping aktiv');
    });

    it('meldet fehlenden Edge-Admin-Key klar statt lokale Provider-Keys zu verlangen', async () => {
      const testMessages: LlmMessage[] = [{ role: 'user', content: 'hi' }];
      mockGetEdgeAdminKey.mockResolvedValueOnce(null);

      const result = await runOrchestrator('groq', 'llama-3.1-8b-instant', 'speed', testMessages);

      expect(result.ok).toBe(false);
      expect(String(result.error || '')).toMatch(/Lokaler (Legacy )?Edge Admin Key/i);
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
            model: 'gpt-5.4-mini',
            status: 429,
          }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          }),
        },
      });

      const result = await runOrchestrator('openai', 'gpt-5.4-mini', 'speed', testMessages);

      expect(result.ok).toBe(false);
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-5.4-mini');
      expect(String(result.error || '')).toBe(
        'Openai meldet ein Rate-Limit oder ist voruebergehend ueberlastet (429).',
      );
      expect(String(result.error || '')).not.toContain('Internal Server Error');
      expect(String(result.error || '')).not.toContain('Edge-Request fehlgeschlagen (429)');
    });

    it('faellt bei provider_env_missing ehrlich auf einen anderen konfigurierten Provider zurueck', async () => {
      const testMessages: LlmMessage[] = [{ role: 'user', content: 'hi' }];

      invokeMock
        .mockResolvedValueOnce({
          data: {
            ok: false,
            code: 'provider_env_missing',
            error: 'Gemini ist serverseitig nicht konfiguriert.',
            provider: 'gemini',
            model: 'gemini-3-flash',
            status: 500,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            ok: true,
            provider: 'openai',
            model: 'gpt-5.4-pro',
            content: 'Fallback ok',
          },
          error: null,
        });

      const result = await runOrchestrator('gemini', 'gemini-3-flash', 'quality', testMessages);

      expect(result.ok).toBe(true);
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-5.4-pro');
      expect(result.fallbackUsed).toBe(true);
      expect(String(result.runtimeNote || '')).toMatch(/Runtime-Fallback aktiv/i);
      expect(invokeMock).toHaveBeenNthCalledWith(
        2,
        SUPABASE_EDGE_FUNCTIONS.K1W1_HANDLER,
        expect.objectContaining({
          body: expect.objectContaining({
            provider: 'openai',
            model: 'gpt-5.4-pro',
          }),
        }),
      );
    });

    it('faellt bei model_not_found zunaechst auf das same-provider-default zurueck', async () => {
      const testMessages: LlmMessage[] = [{ role: 'user', content: 'hi' }];

      invokeMock
        .mockResolvedValueOnce({
          data: {
            ok: false,
            code: 'provider_model_not_found',
            error: 'Das Modell "legacy-openai" ist bei Openai nicht verfuegbar oder wird dort nicht unterstuetzt.',
            provider: 'openai',
            model: 'legacy-openai',
            status: 404,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            ok: true,
            provider: 'openai',
            model: 'gpt-5.4-mini',
            content: 'Fallback same provider ok',
          },
          error: null,
        });

      const result = await runOrchestrator('openai', 'legacy-openai', 'speed', testMessages);

      expect(result.ok).toBe(true);
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-5.4-mini');
      expect(result.fallbackUsed).toBe(true);
      expect(String(result.runtimeNote || '')).toContain('legacy-openai');
      expect(invokeMock).toHaveBeenNthCalledWith(
        2,
        SUPABASE_EDGE_FUNCTIONS.K1W1_HANDLER,
        expect.objectContaining({
          body: expect.objectContaining({
            provider: 'openai',
            model: 'gpt-5.4-mini',
          }),
        }),
      );
    });

    it('meldet fallback exhaustion praezise statt den ersten Providerfehler zu verschleiern', async () => {
      const testMessages: LlmMessage[] = [{ role: 'user', content: 'hi' }];

      invokeMock
        .mockResolvedValueOnce({
          data: {
            ok: false,
            code: 'provider_env_missing',
            error: 'Gemini ist serverseitig nicht konfiguriert.',
            provider: 'gemini',
            model: 'gemini-3-flash',
            status: 500,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            ok: false,
            code: 'provider_env_missing',
            error: 'Openai ist serverseitig nicht konfiguriert.',
            provider: 'openai',
            model: 'gpt-5.4-pro',
            status: 500,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            ok: false,
            code: 'provider_env_missing',
            error: 'Anthropic ist serverseitig nicht konfiguriert.',
            provider: 'anthropic',
            model: 'claude-4-opus-202502',
            status: 500,
          },
          error: null,
        })
        .mockResolvedValue({
          data: {
            ok: false,
            code: 'provider_env_missing',
            error: 'Provider ist serverseitig nicht konfiguriert.',
            status: 500,
          },
          error: null,
        });

      const result = await runOrchestrator('gemini', 'gemini-3-flash', 'quality', testMessages);

      expect(result.ok).toBe(false);
      expect(String(result.error || '')).toContain('keine serverseitig nutzbare Fallback-Route');
      expect(String(result.error || '')).toContain('openai/gpt-5.4-pro');
      expect(result.fallbackUsed).toBe(true);
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
          model: 'claude-4-opus-202502',
          content: 'Validator response',
        },
        error: null,
      });

      const result = await runValidatorOrchestrator(
        'anthropic',
        'claude-4-opus-202502',
        validationMessages,
      );

      expect(result).toMatchObject({
        ok: true,
        text: 'Validator response',
        provider: 'anthropic',
        model: 'claude-4-opus-202502',
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
