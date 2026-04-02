import { makeProjectData } from "./helpers/projectTestHelpers";

const mockGetItem = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: mockGetItem,
}));

const mockGitHub = {
  getWorkflowAdminKey: jest.fn(),
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
        data: { session: { access_token: "supabase-operator-jwt-token" } },
      })),
    },
    functions: { invoke: mockInvoke },
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { startBuildJob } = require("../project/services/buildStartService");

function makeProject(overrides = {}) {
  return makeProjectData({
    linkedRepo: "k1w1-a0style/musik-player",
    linkedBranch: "main",
    ...overrides,
  });
}

describe("build readiness gate - scoped diagnostic readiness", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockImplementation(async (key: string) => ({
      "diagnostic_last_ok::k1w1-a0style%2Fmusik-player::main": "false",
    }[key] ?? null));
    mockGitHub.getWorkflowAdminKey.mockResolvedValue("adminkey");
    mockGitHub.pushFilesToRepo.mockResolvedValue(undefined);
    mockAutoFix.autoFixCIWorkflows.mockResolvedValue(undefined);
    mockInvoke.mockResolvedValue({ data: { jobId: "11111111-1111-1111-1111-111111111111" }, error: null });
  });

  it("blocks build start when the scoped diagnostic key is not true and has no side effects", async () => {
    await expect(startBuildJob({ project: makeProject(), buildProfile: "preview" })).rejects.toThrow(
      /Diagnostik nicht gruen/i,
    );

    await expect(startBuildJob({ project: makeProject(), buildProfile: "preview" })).rejects.toThrow(
      /diagnostic_not_green/,
    );

    expect(mockGitHub.pushFilesToRepo).not.toHaveBeenCalled();
    expect(mockAutoFix.autoFixCIWorkflows).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
