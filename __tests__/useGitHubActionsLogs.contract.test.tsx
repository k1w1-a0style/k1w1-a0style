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
});
