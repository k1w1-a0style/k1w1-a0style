import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useCiLiteWorkflow } from "../components/CiLiteHeaderButton/hooks/useCiLiteWorkflow";
import { WORKFLOW_CI_LITE } from "../components/CiLiteHeaderButton/types";
import { ciLiteSnapshotKeyForSelection } from "../lib/storageKeys";

const mockUseProject = jest.fn();
const mockUseGitHubActionsLogs = jest.fn();
const mockGetRepoSyncState = jest.fn();
const mockRequireSupabaseEdgeUrl = jest.fn();
const mockGetEdgeAdminKey = jest.fn();
const mockGetBranchHeadSha = jest.fn();
const mockStorageGetItem = jest.fn();
const mockStorageMultiSet = jest.fn();

jest.mock("uuid", () => ({
  v4: jest.fn(() => "job-123"),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: (...args: any[]) => mockStorageGetItem(...args),
  multiSet: (...args: any[]) => mockStorageMultiSet(...args),
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
  getBranchHeadSha: (...args: unknown[]) => mockGetBranchHeadSha(...args),
}));

const NOW = 1_710_000_000_000;
const SHA = "a".repeat(40);

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function buildPersistedStorageMap(overrides: Record<string, string | null> = {}): Record<string, string | null> {
  return {
    [ciLiteSnapshotKeyForSelection({ linkedRepo: "owner/repo", linkedBranch: "main" })]: JSON.stringify({
      repo: "owner/repo",
      branch: "main",
      sha: SHA,
      runAtMs: NOW,
      workflowId: "k1w1-ci-lite.yml",
      jobId: "job-123",
      runId: 321,
      conclusion: "success",
      lintOk: true,
      typecheckOk: true,
    }),
    ...overrides,
  };
}

describe("useCiLiteWorkflow behavior", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(NOW);

    mockUseProject.mockReturnValue({
      projectData: {
        linkedRepo: "owner/repo",
        linkedBranch: "main",
        files: [],
      },
    });

    mockGetRepoSyncState.mockResolvedValue("in_sync");
    mockRequireSupabaseEdgeUrl.mockResolvedValue("https://example.supabase.co/functions/v1");
    mockGetEdgeAdminKey.mockResolvedValue("edge-admin-key-12345678901234567890");
    mockGetBranchHeadSha.mockResolvedValue(SHA);
    mockStorageMultiSet.mockResolvedValue(undefined);
    mockStorageGetItem.mockImplementation(async (key: string) => buildPersistedStorageMap()[key] ?? null);

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

    const freshCreatedAt = new Date(NOW).toISOString();

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

      if (url.includes("github-run-artifact-json")) {
        return {
          ok: true,
          json: async () => ({ json: { ok: true, eslint_exit: 0, tsc_exit: 0, github_sha: SHA } }),
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as jest.MockedFunction<typeof fetch>;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });


  it("sends only x-k1w1-admin-key on the CI Lite dispatch edge call", async () => {
    mockStorageGetItem.mockResolvedValue(null);

    const { result } = renderHook(() => useCiLiteWorkflow());

    await act(async () => {
      await result.current.dispatchWorkflow(WORKFLOW_CI_LITE);
    });

    const dispatchCall = (global.fetch as jest.Mock).mock.calls.find(([url]) =>
      String(url).includes("github-workflow-dispatch"),
    );

    expect(dispatchCall).toBeTruthy();
    const headers = ((dispatchCall?.[1] as RequestInit | undefined)?.headers ?? {}) as Record<string, string>;
    expect(headers).toMatchObject({
      "Content-Type": "application/json",
      "x-k1w1-admin-key": "edge-admin-key-12345678901234567890",
    });
    expect(headers).not.toHaveProperty("Authorization");
  });

  it("does not pass githubToken in github-workflow-dispatch bodies", async () => {
    mockStorageGetItem.mockResolvedValue(null);

    const { result } = renderHook(() => useCiLiteWorkflow());

    await act(async () => {
      await result.current.dispatchWorkflow(WORKFLOW_CI_LITE);
    });

    const dispatchCall = (global.fetch as jest.Mock).mock.calls.find(([url]) =>
      String(url).includes("github-workflow-dispatch"),
    );

    expect(dispatchCall).toBeTruthy();

    const dispatchBody = JSON.parse(
      String((dispatchCall?.[1] as RequestInit | undefined)?.body ?? "{}"),
    );

    expect(dispatchBody).toMatchObject({
      githubRepo: "owner/repo",
      workflow: WORKFLOW_CI_LITE,
      ref: "main",
      inputs: { job_id: "job-123" },
    });
    expect(dispatchBody).not.toHaveProperty("githubToken");
  });

  it("hydrates a fresh persisted final state on startup", async () => {
    const { result } = renderHook(() => useCiLiteWorkflow());

    await waitFor(() => {
      expect(result.current.hydratedFromPersistence).toBe(true);
    });

    expect(result.current.headerState).toBe("success");
    expect(result.current.done).toBe(true);
    expect(result.current.ok).toBe(true);
    expect(result.current.busy).toBe(false);
    expect(result.current.targetRef).toBe("main");
    expect(result.current.logLines).toEqual([]);
    expect(result.current.isTrackingRun).toBe(false);
  });

  it("reopens a hydrated final state without dispatching a new run", async () => {
    const { result } = renderHook(() => useCiLiteWorkflow());

    await waitFor(() => {
      expect(result.current.hydratedFromPersistence).toBe(true);
    });

    const dispatchCallsBeforeReopen = (global.fetch as jest.Mock).mock.calls.filter(([url]) =>
      String(url).includes("github-workflow-dispatch"),
    ).length;

    await act(async () => {
      result.current.setVisible(true);
      result.current.setVisible(false);
      result.current.setVisible(true);
    });

    const dispatchCallsAfterReopen = (global.fetch as jest.Mock).mock.calls.filter(([url]) =>
      String(url).includes("github-workflow-dispatch"),
    ).length;

    expect(dispatchCallsAfterReopen).toBe(dispatchCallsBeforeReopen);
    expect(result.current.hydratedFromPersistence).toBe(true);
    expect(result.current.headerState).toBe("success");
    expect(result.current.done).toBe(true);
    expect(result.current.ok).toBe(true);
    expect(result.current.busy).toBe(false);
  });

  it("keeps the hook active after dispatch until the matching run is found", async () => {
    jest.useFakeTimers();
    mockStorageGetItem.mockResolvedValue(null);

    let currentNow = NOW;
    jest.spyOn(Date, "now").mockImplementation(() => currentNow);

    let runLookupCalls = 0;
    (global.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
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
        runLookupCalls += 1;
        return {
          ok: true,
          json: async () => ({
            data: {
              workflow_runs: runLookupCalls === 1
                ? []
                : [
                  {
                    id: 777,
                    html_url: "https://github.com/runs/777",
                    display_title: "CI Lite (job_id=job-123)",
                    event: "workflow_dispatch",
                    head_branch: "main",
                    created_at: new Date(currentNow).toISOString(),
                  },
                ],
            },
          }),
        } as Response;
      }

      if (url.includes("github-run-artifact-json")) {
        return {
          ok: true,
          json: async () => ({ json: { ok: true, eslint_exit: 0, tsc_exit: 0, github_sha: SHA } }),
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { result } = renderHook(() => useCiLiteWorkflow());

    await act(async () => {
      await result.current.dispatchWorkflow(WORKFLOW_CI_LITE);
    });

    expect(result.current.dispatching).toBe(false);
    expect(result.current.runLookupActive).toBe(true);
    expect(result.current.trackedRunId).toBeNull();
    expect(result.current.busy).toBe(true);
    expect(result.current.isTrackingRun).toBe(true);
    expect(result.current.headerState).toBe("running");

    await act(async () => {
      currentNow += 2_500;
      jest.advanceTimersByTime(2_500);
    });
    await flushAsyncWork();

    expect(result.current.trackedRunId).toBe(777);
    expect(result.current.runLookupActive).toBe(false);
    expect(result.current.busy).toBe(true);
    expect(result.current.isTrackingRun).toBe(true);
    expect(result.current.headerState).toBe("running");
  });

  it("ends the lookup state cleanly when no matching run is found before timeout", async () => {
    jest.useFakeTimers();
    mockStorageGetItem.mockResolvedValue(null);

    let currentNow = NOW;
    jest.spyOn(Date, "now").mockImplementation(() => currentNow);

    (global.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
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
              workflow_runs: [],
            },
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { result } = renderHook(() => useCiLiteWorkflow());

    await act(async () => {
      await result.current.dispatchWorkflow(WORKFLOW_CI_LITE);
    });

    expect(result.current.runLookupActive).toBe(true);
    expect(result.current.busy).toBe(true);
    expect(result.current.headerState).toBe("running");

    await act(async () => {
      currentNow += 60_001;
      jest.advanceTimersByTime(60_001);
    });
    await flushAsyncWork();

    expect(result.current.trackedRunId).toBeNull();
    expect(result.current.runLookupActive).toBe(false);
    expect(result.current.busy).toBe(false);
    expect(result.current.isTrackingRun).toBe(false);
    expect(result.current.headerState).toBe("idle");
    expect(result.current.showError).toMatch(/kein passender Run gefunden \(Timeout\)/i);
  });

  it("keeps tracking the active run after the modal is closed and reopens without redispatch", async () => {
    mockStorageGetItem.mockResolvedValue(null);

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

  it("surfaces missing GitHub token as an explicit CI-Lite dispatch error", async () => {
    mockStorageGetItem.mockResolvedValue(null);
    (global.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("github-workflow-dispatch")) {
        return {
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text: async () => JSON.stringify({ ok: false, error: "Missing GitHub token" }),
        } as Response;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { result } = renderHook(() => useCiLiteWorkflow());

    await act(async () => {
      await result.current.dispatchWorkflow(WORKFLOW_CI_LITE);
    });

    expect(result.current.showError).toMatch(/CI Lite Dispatch blockiert/i);
    expect(result.current.showError).toMatch(/GitHub-Token fehlt/i);
    expect(result.current.showError).not.toMatch(/HTTP 500/i);
  });

  it("maps a dispatch 404 to a workflow-not-found user error", async () => {
    mockStorageGetItem.mockResolvedValue(null);
    (global.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("github-workflow-dispatch")) {
        return {
          ok: false,
          status: 404,
          statusText: "Not Found",
          text: async () => JSON.stringify({
            error: "GitHub workflow dispatch failed (workflow not found)",
            details: {
              hint: "Workflow not found in repo. Ensure the workflow file exists under .github/workflows.",
            },
          }),
        } as Response;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { result } = renderHook(() => useCiLiteWorkflow());

    await act(async () => {
      await result.current.dispatchWorkflow(WORKFLOW_CI_LITE);
    });

    expect(result.current.showError).toMatch(/Workflow-Datei\/Workflow .* nicht gefunden/i);
    expect(result.current.showError).not.toMatch(/github-workflow-dispatch failed/i);
  });

  it("surfaces unscoped workflow-run lookup as a contract error", async () => {
    mockStorageGetItem.mockResolvedValue(null);
    (global.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
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
            ok: true,
            data: { workflow_runs: [] },
            note: "workflowId not found; returned repo-wide workflow runs instead",
          }),
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { result } = renderHook(() => useCiLiteWorkflow());

    await act(async () => {
      await result.current.dispatchWorkflow(WORKFLOW_CI_LITE);
    });

    expect(result.current.runLookupActive).toBe(false);
    expect(result.current.showError).toMatch(/nicht workflow-spezifisch abgesichert/i);
  });

  it("classifies a server-rejected local Edge Admin Key honestly during CI-Lite dispatch", async () => {
    mockStorageGetItem.mockResolvedValue(null);
    (global.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("github-workflow-dispatch")) {
        return {
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          text: async () => "missing or invalid admin key",
        } as Response;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { result } = renderHook(() => useCiLiteWorkflow());

    await act(async () => {
      await result.current.dispatchWorkflow(WORKFLOW_CI_LITE);
    });

    expect(result.current.showError).toMatch(/CI Lite Dispatch blockiert/i);
    expect(result.current.showError).toMatch(/lokaler edge admin key ist lokal vorhanden/i);
    expect(result.current.showError).toMatch(/abgelehnt/i);
    expect(result.current.showError).not.toMatch(/lokaler edge admin key fehlt/i);
    expect(result.current.showError).not.toContain("edge-admin-key");
  });

  it("persists completed CI-Lite runs under the repo/branch-scoped snapshot contract", async () => {
    mockStorageGetItem.mockResolvedValue(null);
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
        logs: [{ timestamp: "", message: "done", level: "raw" }],
        workflowRun: {
          id: options.runId,
          run_number: 12,
          status: "completed",
          conclusion: "success",
          created_at: "2026-03-19T00:00:00Z",
          updated_at: "2026-03-19T00:00:05Z",
          html_url: `https://github.com/runs/${options.runId}`,
          head_sha: SHA,
        },
        isLoading: false,
        error: null,
        refreshLogs: jest.fn(),
      };
    });

    const { result } = renderHook(() => useCiLiteWorkflow());

    await act(async () => {
      await result.current.dispatchWorkflow(WORKFLOW_CI_LITE);
    });

    await waitFor(() => {
      expect(mockStorageMultiSet).toHaveBeenCalled();
    });

    const persistedEntries = mockStorageMultiSet.mock.calls.at(-1)?.[0] as [string, string][];
    const scopedEntry = persistedEntries.find(([key]) =>
      key === ciLiteSnapshotKeyForSelection({ linkedRepo: "owner/repo", linkedBranch: "main" }),
    );

    expect(scopedEntry).toBeTruthy();
    expect(scopedEntry?.[1]).toBe(
      JSON.stringify({
        repo: "owner/repo",
        branch: "main",
        sha: SHA,
        runAtMs: NOW,
        workflowId: "k1w1-ci-lite.yml",
        jobId: "job-123",
        runId: 321,
        conclusion: "success",
        lintOk: true,
        typecheckOk: true,
      }),
    );
  });
});
