import type { ProjectData } from "../shared/types/project";

const mockGetItem = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: (...args: any[]) => mockGetItem(...args),
}));

const mockGitHub = {
  getEdgeAdminKey: jest.fn(),
  pushFilesToRepo: jest.fn(),
};
const mockAutoFix = { autoFixCIWorkflows: jest.fn() };
const mockInvoke = jest.fn();

jest.doMock(require.resolve("../infra/github/githubService"), () => mockGitHub);
jest.doMock(require.resolve("../lib/diagnostics/ciAutoFix"), () => mockAutoFix);
jest.doMock(require.resolve("../lib/supabase"), () => ({
  ensureSupabaseClient: jest.fn(async () => ({
    auth: {
      getSession: jest.fn(async () => ({
        data: { session: { access_token: "supabase-authenticated-jwt-token" } },
      })),
    },
    functions: { invoke: mockInvoke },
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { startBuildJob } = require("../project/services/buildStartService");

function makeProject(overrides: Partial<ProjectData> = {}): ProjectData {
  return {
    id: "p1",
    name: "test",
    files: [{ path: "app.json", content: "{}", updatedAt: Date.now() } as any],
    linkedRepo: "k1w1-a0style/musik-player",
    linkedBranch: "main",
    ...overrides,
  } as any;
}

describe("build readiness gate - ci lite freshness", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGitHub.getEdgeAdminKey.mockResolvedValue("adminkey");
    mockGitHub.pushFilesToRepo.mockResolvedValue(undefined);
    mockAutoFix.autoFixCIWorkflows.mockResolvedValue(undefined);
    mockInvoke.mockResolvedValue({ data: { jobId: "11111111-1111-1111-1111-111111111111" }, error: null });
  });

  it("blocks build start when last CI Lite repo does not match", async () => {
    const now = Date.now();
    mockGetItem.mockImplementation(async (key: string) => ({
      diagnostic_last_ok: "true",
      ci_lite_lint_ok: "true",
      ci_lite_typecheck_ok: "true",
      ci_lite_last_run_at: String(now),
      ci_lite_last_repo: "other/repo",
      ci_lite_last_branch: "main",
    }[key] ?? null));

    await expect(startBuildJob({ project: makeProject(), buildProfile: "preview" })).rejects.toThrow(
      /anderem Repo/i,
    );

    expect(mockGitHub.pushFilesToRepo).not.toHaveBeenCalled();
    expect(mockAutoFix.autoFixCIWorkflows).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("blocks build start when last CI Lite run is stale", async () => {
    const stale = Date.now() - 7 * 60 * 60 * 1000;
    mockGetItem.mockImplementation(async (key: string) => ({
      diagnostic_last_ok: "true",
      ci_lite_lint_ok: "true",
      ci_lite_typecheck_ok: "true",
      ci_lite_last_run_at: String(stale),
      ci_lite_last_repo: "k1w1-a0style/musik-player",
      ci_lite_last_branch: "main",
    }[key] ?? null));

    await expect(startBuildJob({ project: makeProject(), buildProfile: "preview" })).rejects.toThrow(
      /veraltet/i,
    );

    expect(mockGitHub.pushFilesToRepo).not.toHaveBeenCalled();
    expect(mockAutoFix.autoFixCIWorkflows).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
