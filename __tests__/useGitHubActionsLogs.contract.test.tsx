import { renderHook, act, waitFor } from '@testing-library/react-native';

import { useGitHubActionsLogs } from '../hooks/useGitHubActionsLogs';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

jest.mock('../lib/supabaseEdge', () => ({
  requireSupabaseEdgeUrl: jest.fn(async () => 'https://example.supabase.co/functions/v1'),
}));

jest.mock('../infra/github/githubService', () => ({
  getEdgeAdminKey: jest.fn(async () => 'edge-admin-key'),
}));

jest.mock('../infra/github/tokenStore', () => ({
  getGitHubToken: jest.fn(async () => 'ghp_test_token'),
}));

describe('useGitHubActionsLogs edge contract mapping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });


  it('does not send githubToken in github-workflow-runs or github-workflow-logs bodies', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            workflow_runs: [{ id: 123, status: 'queued', html_url: 'https://github.com/runs/123' }],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, logsText: '' }),
      });

    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() =>
      useGitHubActionsLogs({
        githubRepo: 'owner/repo',
        runId: null,
        workflowId: 'k1w1-ci-lite.yml',
        autoRefresh: false,
      }),
    );

    await act(async () => {
      await result.current.refreshLogs();
    });

    const runsCall = fetchMock.mock.calls.find(
      (args) => typeof args?.[0] === 'string' && args[0].includes('github-workflow-runs'),
    );
    const logsCall = fetchMock.mock.calls.find(
      (args) => typeof args?.[0] === 'string' && args[0].includes('github-workflow-logs'),
    );

    expect(runsCall).toBeTruthy();
    expect(logsCall).toBeTruthy();

    const runsBody = JSON.parse(String((runsCall?.[1] as RequestInit | undefined)?.body ?? '{}'));
    const logsBody = JSON.parse(String((logsCall?.[1] as RequestInit | undefined)?.body ?? '{}'));

    expect(runsBody).toEqual({ githubRepo: 'owner/repo', workflowId: 'k1w1-ci-lite.yml' });
    expect(logsBody).toEqual({ githubRepo: 'owner/repo', runId: 123, mode: 'raw' });
    expect(runsBody).not.toHaveProperty('githubToken');
    expect(logsBody).not.toHaveProperty('githubToken');
  });

  it('uses the current workflowId for github-workflow-runs after rerender', async () => {
    const fetchMock = jest.fn()
      // first refresh: runs
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            workflow_runs: [{ id: 111, status: 'queued', html_url: 'https://github.com/runs/111' }],
          },
        }),
      })
      // first refresh: logs
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, logsText: '' }),
      })
      // second refresh: runs
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            workflow_runs: [{ id: 222, status: 'queued', html_url: 'https://github.com/runs/222' }],
          },
        }),
      })
      // second refresh: logs
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, logsText: '' }),
      });

    global.fetch = fetchMock as unknown as typeof fetch;

    const { result, rerender } = renderHook<
      ReturnType<typeof useGitHubActionsLogs>,
      { workflowId: string }
    >(
      ({ workflowId }) =>
        useGitHubActionsLogs({
          githubRepo: 'owner/repo',
          runId: null,
          workflowId,
          autoRefresh: false,
        }),
      { initialProps: { workflowId: 'k1w1-ci-lite.yml' } },
    );

    await act(async () => {
      await result.current.refreshLogs();
    });

    rerender({ workflowId: 'k1w1-ci-lite-autofix.yml' });

    await act(async () => {
      await result.current.refreshLogs();
    });

    const runsCalls = fetchMock.mock.calls.filter(
      (args) => typeof args?.[0] === 'string' && args[0].includes('github-workflow-runs'),
    );

    expect(runsCalls).toHaveLength(2);

    const firstBody = JSON.parse(String((runsCalls[0][1] as RequestInit)?.body ?? '{}'));
    const secondBody = JSON.parse(String((runsCalls[1][1] as RequestInit)?.body ?? '{}'));

    expect(firstBody.workflowId).toBe('k1w1-ci-lite.yml');
    expect(secondBody.workflowId).toBe('k1w1-ci-lite-autofix.yml');
  });

  it('clears stale workflowRun/logs when repo or runId changes', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          logsText: 'first-log-line',
          run: {
            id: 111,
            run_number: 1,
            status: 'in_progress',
            conclusion: null,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
            html_url: 'https://github.com/runs/111',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, logsText: '' }),
      });

    global.fetch = fetchMock as unknown as typeof fetch;

    const { result, rerender } = renderHook<
      ReturnType<typeof useGitHubActionsLogs>,
      { githubRepo: string | null; runId: number | null }
    >(
      ({ githubRepo, runId }) =>
        useGitHubActionsLogs({
          githubRepo,
          runId,
          workflowId: 'k1w1-ci-lite.yml',
          autoRefresh: false,
        }),
      { initialProps: { githubRepo: 'owner/repo-a', runId: 111 } },
    );

    await act(async () => {
      await result.current.refreshLogs();
    });

    expect(result.current.workflowRun?.id).toBe(111);
    expect(result.current.logs).toHaveLength(1);

    rerender({ githubRepo: 'owner/repo-b', runId: 222 });

    expect(result.current.workflowRun).toBeNull();
    expect(result.current.logs).toEqual([]);

    await act(async () => {
      await result.current.refreshLogs();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('preserves the last known run state when autoRefresh is turned off', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        logsText: 'first-log-line',
        run: {
          id: 333,
          run_number: 7,
          status: 'completed',
          conclusion: 'success',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:01:00Z',
          html_url: 'https://github.com/runs/333',
        },
      }),
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const { result, rerender } = renderHook<
      ReturnType<typeof useGitHubActionsLogs>,
      { autoRefresh: boolean }
    >(
      ({ autoRefresh }) =>
        useGitHubActionsLogs({
          githubRepo: 'owner/repo',
          runId: 333,
          workflowId: 'k1w1-ci-lite.yml',
          autoRefresh,
        }),
      { initialProps: { autoRefresh: true } },
    );

    await waitFor(() => {
      expect(result.current.workflowRun?.id).toBe(333);
      expect(result.current.logs).toHaveLength(1);
    });

    rerender({ autoRefresh: false });

    expect(result.current.workflowRun?.id).toBe(333);
    expect(result.current.logs).toEqual([
      expect.objectContaining({ message: 'first-log-line' }),
    ]);
  });

  it("maps abortable fetch failures onto the timeout/abort error contract", async () => {
    const fetchMock = jest.fn(async (_: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBeDefined();
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() =>
      useGitHubActionsLogs({
        githubRepo: "owner/repo",
        runId: 999,
        workflowId: "k1w1-ci-lite.yml",
        autoRefresh: false,
      }),
    );

    await act(async () => {
      await result.current.refreshLogs();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][1] as RequestInit | undefined)?.signal).toBeDefined();
    expect(result.current.error).toBe("Request timeout - GitHub Actions Logs Anfrage abgebrochen");
    expect(result.current.isLoading).toBe(false);
  });

  it('does not invalidate the active request when refreshLogs is called again while loading', async () => {
    const fetchDeferred = createDeferred<{
      ok: boolean;
      json: () => Promise<{
        ok: boolean;
        logsText: string;
        run: {
          id: number;
          run_number: number;
          status: string;
          conclusion: string | null;
          created_at: string;
          updated_at: string;
          html_url: string;
        };
      }>;
    }>();

    const fetchMock = jest.fn(() => fetchDeferred.promise);
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() =>
      useGitHubActionsLogs({
        githubRepo: 'owner/repo',
        runId: 444,
        workflowId: 'k1w1-ci-lite.yml',
        autoRefresh: false,
      }),
    );

    let firstRefreshPromise!: Promise<void>;
    act(() => {
      firstRefreshPromise = result.current.refreshLogs();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    await act(async () => {
      await result.current.refreshLogs();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      fetchDeferred.resolve({
        ok: true,
        json: async () => ({
          ok: true,
          logsText: 'first-log-line',
          run: {
            id: 444,
            run_number: 4,
            status: 'completed',
            conclusion: 'success',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:01:00Z',
            html_url: 'https://github.com/runs/444',
          },
        }),
      });
      await firstRefreshPromise;
    });

    expect(result.current.logs).toEqual([
      expect.objectContaining({ message: 'first-log-line' }),
    ]);
    expect(result.current.workflowRun?.id).toBe(444);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('keeps the first auto-refresh fetch after a selection change alive', async () => {
    const firstFetchDeferred = createDeferred<{
      ok: boolean;
      json: () => Promise<{
        ok: boolean;
        logsText: string;
        run: {
          id: number;
          run_number: number;
          status: string;
          conclusion: string | null;
          created_at: string;
          updated_at: string;
          html_url: string;
        };
      }>;
    }>();
    const secondFetchDeferred = createDeferred<{
      ok: boolean;
      json: () => Promise<{
        ok: boolean;
        logsText: string;
        run: {
          id: number;
          run_number: number;
          status: string;
          conclusion: string | null;
          created_at: string;
          updated_at: string;
          html_url: string;
        };
      }>;
    }>();
    const fetchDeferreds = [firstFetchDeferred, secondFetchDeferred];
    const requestSignals: AbortSignal[] = [];

    const fetchMock = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal;
      requestSignals.push(signal);
      const deferred = fetchDeferreds.shift();
      if (!deferred) {
        throw new Error('missing deferred fetch response');
      }

      signal.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        deferred.reject(err);
      });

      return deferred.promise;
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result, rerender } = renderHook<
      ReturnType<typeof useGitHubActionsLogs>,
      { runId: number }
    >(
      ({ runId }) =>
        useGitHubActionsLogs({
          githubRepo: 'owner/repo',
          runId,
          workflowId: 'k1w1-ci-lite.yml',
          autoRefresh: true,
        }),
      { initialProps: { runId: 111 } },
    );

    await act(async () => {
      firstFetchDeferred.resolve({
        ok: true,
        json: async () => ({
          ok: true,
          logsText: 'old-log-line',
          run: {
            id: 111,
            run_number: 1,
            status: 'completed',
            conclusion: 'success',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:01:00Z',
            html_url: 'https://github.com/runs/111',
          },
        }),
      });
    });

    await waitFor(() => {
      expect(result.current.workflowRun?.id).toBe(111);
      expect(result.current.logs).toEqual([
        expect.objectContaining({ message: 'old-log-line' }),
      ]);
    });

    rerender({ runId: 222 });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.current.isLoading).toBe(true);
    });

    expect(requestSignals[1]?.aborted).toBe(false);
    expect(result.current.logs).toEqual([]);
    expect(result.current.workflowRun).toBeNull();

    await act(async () => {
      secondFetchDeferred.resolve({
        ok: true,
        json: async () => ({
          ok: true,
          logsText: 'new-log-line',
          run: {
            id: 222,
            run_number: 2,
            status: 'in_progress',
            conclusion: null,
            created_at: '2026-01-01T00:02:00Z',
            updated_at: '2026-01-01T00:03:00Z',
            html_url: 'https://github.com/runs/222',
          },
        }),
      });
    });

    await waitFor(() => {
      expect(result.current.workflowRun?.id).toBe(222);
      expect(result.current.logs).toEqual([
        expect.objectContaining({ message: 'new-log-line' }),
      ]);
      expect(result.current.isLoading).toBe(false);
    });
  });

});
