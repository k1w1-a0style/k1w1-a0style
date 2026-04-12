import { makeProjectData } from "./helpers/projectTestHelpers";

const mockGetItem = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: mockGetItem,
}));

const mockGitHub = {
  getDefaultBranch: jest.fn(),
  pushFilesToRepo: jest.fn(),
  getWorkflowAdminKey: jest.fn(),
};
const mockAutoFix = { autoFixCIWorkflows: jest.fn() };
const mockInvoke = jest.fn();

jest.doMock(require.resolve("../infra/github/githubService"), () => mockGitHub);
jest.doMock(require.resolve("../lib/diagnostics/ciAutoFix"), () => mockAutoFix);
jest.doMock(require.resolve("../lib/supabase"), () => ({
  ensureSupabaseClient: jest.fn(async () => ({
    auth: {
      getSession: jest.fn(async () => ({
        data: { session: { access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYnVpbGRfYWRtaW4ifQ.signature" } },
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
    linkedBranch: "",
    ...overrides,
  });
}

describe("build readiness gate - linkedBranch missing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue("true");
    mockGitHub.getDefaultBranch.mockResolvedValue("main");
    mockGitHub.pushFilesToRepo.mockResolvedValue(undefined);
    mockGitHub.getWorkflowAdminKey.mockResolvedValue("adminkey");
    mockAutoFix.autoFixCIWorkflows.mockResolvedValue(undefined);
    mockInvoke.mockResolvedValue({ data: { jobId: "11111111-1111-1111-1111-111111111111" }, error: null });
  });

  it("blocks before dispatch/push and does not use default-branch fallback", async () => {
    await expect(startBuildJob({ project: makeProject(), buildProfile: "preview" })).rejects.toThrow(
      /Branch fehlt/i,
    );

    await expect(startBuildJob({ project: makeProject(), buildProfile: "preview" })).rejects.toThrow(
      /missing_branch/,
    );

    expect(mockGitHub.getDefaultBranch).not.toHaveBeenCalled();
    expect(mockGitHub.pushFilesToRepo).not.toHaveBeenCalled();
    expect(mockAutoFix.autoFixCIWorkflows).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
