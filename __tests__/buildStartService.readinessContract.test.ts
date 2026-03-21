import type { ProjectData } from "../shared/types/project";

const mockGetItem = jest.fn();
const mockAssertBuildReadiness = jest.fn();
const mockInvoke = jest.fn();
const mockGetRepoSyncState = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: (...args: any[]) => mockGetItem(...args),
}));

jest.doMock(require.resolve("../lib/buildReadiness"), () => {
  const actual = jest.requireActual("../lib/buildReadiness");
  return {
    ...actual,
    assertBuildReadiness: (...args: any[]) => mockAssertBuildReadiness(...args),
  };
});

jest.doMock(require.resolve("../infra/github/githubService"), () => ({
  getEdgeAdminKey: jest.fn(),
  pushFilesToRepo: jest.fn(),
}));

jest.doMock(require.resolve("../lib/diagnostics/ciAutoFix"), () => ({
  autoFixCIWorkflows: jest.fn(),
}));

jest.doMock(require.resolve("../lib/repoSyncOrchestration"), () => {
  const actual = jest.requireActual("../lib/repoSyncOrchestration");
  return {
    ...actual,
    getRepoSyncState: (...args: any[]) => mockGetRepoSyncState(...args),
    markRepoSyncSignature: jest.fn(),
  };
});

jest.doMock(require.resolve("../lib/supabase"), () => ({
  ensureSupabaseClient: jest.fn(async () => ({ functions: { invoke: mockInvoke } })),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { startBuildJob } = require("../project/services/buildStartService");

function makeProject(overrides: Partial<ProjectData> = {}): ProjectData {
  return {
    id: "p1",
    name: "test",
    files: [{ path: "app.json", content: "{}", updatedAt: Date.now() } as any],
    linkedRepo: "owner/repo",
    linkedBranch: "main",
    ...overrides,
  } as any;
}

describe("startBuildJob readiness contract integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAssertBuildReadiness.mockRejectedValue(
      new Error("ci_lite_sha_mismatch: Repo/Branch wurden seit dem letzten CI-Lite-Run geaendert (SHA-Mismatch)"),
    );
    mockGetRepoSyncState.mockResolvedValue("in_sync");
    mockInvoke.mockResolvedValue({ data: { jobId: 42 }, error: null });
  });

  it("delegates build gating to the centralized readiness contract before sync or dispatch", async () => {
    const project = makeProject();

    await expect(startBuildJob({ project, buildProfile: "preview" })).rejects.toThrow(
      /ci_lite_sha_mismatch/i,
    );

    expect(mockAssertBuildReadiness).toHaveBeenCalledWith(project, {});
    expect(mockGetRepoSyncState).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
