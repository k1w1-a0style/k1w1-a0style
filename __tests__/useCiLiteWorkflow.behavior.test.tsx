import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useCiLiteWorkflow } from "../components/CiLiteHeaderButton/hooks/useCiLiteWorkflow";
import { WORKFLOW_CI_LITE } from "../components/CiLiteHeaderButton/types";

const mockUseProject = jest.fn();
const mockUseGitHubActionsLogs = jest.fn();
const mockGetRepoSyncState = jest.fn();
const mockRequireSupabaseEdgeUrl = jest.fn();
const mockGetEdgeAdminKey = jest.fn();
const mockGetGitHubToken = jest.fn();

jest.mock("uuid", () => ({
  v4: jest.fn(() => "job-123"),
}));

jest.mock("../contexts/ProjectContext", () => ({
  useProject: () => mockUseProject(),
}));

jest.mock("../hooks/useGitHubActionsLogs", () => ({
  useGitHubActionsLogs: (options: unknown) => mockUseGitHubActionsLogs(options),
}));

jest.mock("../lib/repoSyncOrchestration", () => ({
  getRepoSyncState: (...args: unknown[]) => mockGetRepoSyncState(...args),
}));

jest.mock("../lib/supabaseEdge", () => ({
  requireSupabaseEdgeUrl: () => mockRequireSupabaseEdgeUrl(),
}));

jest.mock("../infra/github/githubService", () => ({
  getEdgeAdminKey: () => mockGetEdgeAdminKey(),
}));

jest.mock("../infra/github/tokenStore", () => ({
  getGitHubToken: () => mockGetGitHubToken(),
}));

describe("useCiLiteWorkflow behavior", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseProject.mockReturnValue({
      projectData: {
        linkedRepo: "owner/repo",
        linkedBranch: "main",
        files: [],
      },
    });

    mockGetRepoSyncState.mockResolvedValue("in_sync");
    mockRequireSupabaseEdgeUrl.mockResolvedValue("https://example.supabase.co/functions/v1");
    mockGetEdgeAdminKey.mockResolvedValue("edge-admin-key");
    mockGetGitHubToken.mockResolvedValue("gh-token");

    mockUseGitHubActionsLogs.mockImplementation((options: any) => {
      if (!options?.runId) {
        return {
          logs: [],
          workflowRun: null,
          isLoading: false,
          error: null,
          refreshLogs: jest.fn(),
        };
      }

      return {
        logs: [{ timestamp: "", message: "still running", level: "raw" }],
        workflowRun: {
          id: options.runId,
          run_number: 12,
          status: "in_progress",
          conclusion: null,
          created_at: "2026-03-19T00:00:00Z",
          updated_at: "2026-03-19T00:00:05Z",
          html_url: `https://github.com/runs/${options.runId}`,
          head_sha: "abc123",
        },
        isLoading: false,
        error: null,
        refreshLogs: jest.fn(),
      };
    });

    const freshCreatedAt = new Date(Date.now()).toISOString();

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("github-workflow-dispatch")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => "",
        } as Response;
      }

      if (url.includes("github-workflow-runs")) {
        return {
          ok: true,
          json: async () => ({
            data: {
              workflow_runs: [
                {
                  id: 321,
                  html_url: "https://github.com/runs/321",
                  display_title: "CI Lite (job_id=job-123)",
                  event: "workflow_dispatch",
                  head_branch: "main",
                  created_at: freshCreatedAt,
                },
              ],
            },
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as jest.MockedFunction<typeof fetch>;
  });

  it("keeps tracking the active run after the modal is closed and reopens without redispatch", async () => {
    const { result } = renderHook(() => useCiLiteWorkflow());

    await act(async () => {
      await result.current.dispatchWorkflow(WORKFLOW_CI_LITE);
    });

    await waitFor(() => {
      expect(result.current.trackedRunId).toBe(321);
    });

    expect(result.current.logLines).toEqual(["still running"]);
    expect(mockUseGitHubActionsLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({
        githubRepo: "owner/repo",
        runId: 321,
        autoRefresh: true,
      }),
    );

    await act(async () => {
      result.current.setVisible(false);
    });

    expect(result.current.visible).toBe(false);
    expect(result.current.isTrackingRun).toBe(true);
    expect(result.current.logLines).toEqual(["still running"]);
    expect(mockUseGitHubActionsLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({
        githubRepo: "owner/repo",
        runId: 321,
        autoRefresh: true,
      }),
    );

    const dispatchCallsBeforeReopen = (global.fetch as jest.Mock).mock.calls.filter(([url]) =>
      String(url).includes("github-workflow-dispatch"),
    ).length;

    await act(async () => {
      result.current.setVisible(true);
    });

    expect(result.current.visible).toBe(true);
    expect(result.current.logLines).toEqual(["still running"]);

    const dispatchCallsAfterReopen = (global.fetch as jest.Mock).mock.calls.filter(([url]) =>
      String(url).includes("github-workflow-dispatch"),
    ).length;

    expect(dispatchCallsAfterReopen).toBe(dispatchCallsBeforeReopen);
  });
});
