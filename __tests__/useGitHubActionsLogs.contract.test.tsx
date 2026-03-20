import { renderHook, act } from '@testing-library/react-native';

import { useGitHubActionsLogs } from '../hooks/useGitHubActionsLogs';

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

    await act(async () => {
      await result.current.refreshLogs();
    });

    expect(result.current.workflowRun?.id).toBe(333);
    expect(result.current.logs).toHaveLength(1);

    rerender({ autoRefresh: false });

    expect(result.current.workflowRun?.id).toBe(333);
    expect(result.current.logs).toEqual([
      expect.objectContaining({ message: 'first-log-line' }),
    ]);
  });

});
