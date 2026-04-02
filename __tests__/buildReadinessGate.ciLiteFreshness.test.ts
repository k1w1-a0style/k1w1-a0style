import { makeProjectData } from "./helpers/projectTestHelpers";

const mockGetItem = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: mockGetItem,
}));

const mockGitHub = {
  getWorkflowAdminKey: jest.fn(),
  pushFilesToRepo: jest.fn(),
  getBranchHeadSha: jest.fn(),
};
const mockAutoFix = { autoFixCIWorkflows: jest.fn() };
const mockInvoke = jest.fn();

jest.doMock(require.resolve("../infra/github/githubService"), () => mockGitHub);
jest.doMock(require.resolve("../lib/diagnostics/ciAutoFix"), () => mockAutoFix);
jest.doMock(require.resolve("../lib/supabase"), () => ({
  ensureSupabaseClient: jest.fn(async () => ({
    auth: {
      getSession: jest.fn(async () => ({
        data: { session: { access_token: "supabase-operator-jwt-token" } },
      })),
    },
    functions: { invoke: mockInvoke },
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { startBuildJob } = require("../project/services/buildStartService");

const FIXED_NOW = Date.parse("2026-03-30T00:00:00.000Z");

function makeProject(overrides = {}) {
  return makeProjectData({
    linkedRepo: "k1w1-a0style/musik-player",
    linkedBranch: "main",
    ...overrides,
  });
}

describe("build readiness gate - ci lite freshness", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
    mockGitHub.getWorkflowAdminKey.mockResolvedValue("adminkey");
    mockGitHub.getBranchHeadSha.mockResolvedValue("0123456789abcdef0123456789abcdef01234567");
    mockGitHub.pushFilesToRepo.mockResolvedValue(undefined);
    mockAutoFix.autoFixCIWorkflows.mockResolvedValue(undefined);
    mockInvoke.mockResolvedValue({ data: { jobId: "11111111-1111-1111-1111-111111111111" }, error: null });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("blocks build start when last CI Lite repo does not match", async () => {
    mockGetItem.mockImplementation(async (key: string) => ({
      "diagnostic_last_ok::k1w1-a0style%2Fmusik-player::main": "true",
      ci_lite_lint_ok: "true",
      ci_lite_typecheck_ok: "true",
      ci_lite_last_run_at: String(FIXED_NOW),
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
    const stale = FIXED_NOW - 7 * 60 * 60 * 1000;
    mockGetItem.mockImplementation(async (key: string) => ({
      "diagnostic_last_ok::k1w1-a0style%2Fmusik-player::main": "true",
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
