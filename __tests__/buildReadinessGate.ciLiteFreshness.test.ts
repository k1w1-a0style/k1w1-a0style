import { makeProjectData } from "./helpers/projectTestHelpers";
import { buildDiagnosticReadinessRecord, computeDiagnosticProjectFingerprint } from "../lib/diagnosticReadinessRecord";
import { diagnosticReadinessRecordKeyForSelection } from "../lib/storageKeys";

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
const mockReadPersistedCiLiteSelection = jest.fn();

jest.doMock(require.resolve("../infra/github/githubService"), () => mockGitHub);
jest.doMock(require.resolve("../lib/diagnostics/ciAutoFix"), () => mockAutoFix);
jest.doMock(require.resolve("../lib/ciLitePersistence"), () => {
  const actual = jest.requireActual("../lib/ciLitePersistence");
  return {
    ...actual,
    readPersistedCiLiteSelection: (...args: unknown[]) => mockReadPersistedCiLiteSelection(...args),
  };
});
jest.doMock(require.resolve("../lib/diagnosticReadinessRecord"), () => {
  const actual = jest.requireActual("../lib/diagnosticReadinessRecord");
  return {
    ...actual,
    readDiagnosticReadinessRecord: jest.fn(async () => ({
      version: 2,
      repo: "k1w1-a0style/musik-player",
      branch: "main",
      projectFingerprint: "test-fingerprint",
      diagnosticOk: true,
      includePipelineChecks: true,
      focusedModes: ["preview"],
      checkedAt: new Date(0).toISOString(),
    })),
  };
});
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
    mockReadPersistedCiLiteSelection.mockResolvedValue({
      snapshot: {
        repo: "k1w1-a0style/musik-player",
        branch: "main",
        sha: "0123456789abcdef0123456789abcdef01234567",
        runAtMs: FIXED_NOW,
        workflowId: "k1w1-ci-lite.yml",
        jobId: null,
        runId: null,
        conclusion: "success",
        lintOk: true,
        typecheckOk: true,
      },
      reason: null,
      stale: false,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("blocks build start when last CI Lite repo does not match", async () => {
    const project = makeProject();
    const readinessKey = diagnosticReadinessRecordKeyForSelection({
      linkedRepo: project.linkedRepo,
      linkedBranch: project.linkedBranch,
    });
    const readinessRecord = buildDiagnosticReadinessRecord({
      repo: project.linkedRepo ?? "",
      branch: project.linkedBranch ?? "",
      projectFingerprint: computeDiagnosticProjectFingerprint(project.files),
      diagnosticOk: true,
      includePipelineChecks: true,
      focusedModes: ["preview"],
    });
    mockGetItem.mockImplementation(async (key: string) =>
      key === readinessKey || key.startsWith("diagnostic_readiness_record::")
        ? JSON.stringify(readinessRecord)
        : "true",
    );
    mockReadPersistedCiLiteSelection.mockResolvedValue({
      snapshot: null,
      reason: "CI-Lite gehoert zu anderem Repo",
      stale: false,
    });

    await expect(startBuildJob({ project, buildProfile: "preview" })).rejects.toThrow(
      /anderem Repo/i,
    );

    expect(mockGitHub.pushFilesToRepo).not.toHaveBeenCalled();
    expect(mockAutoFix.autoFixCIWorkflows).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("blocks build start when last CI Lite run is stale", async () => {
    const project = makeProject();
    const readinessKey = diagnosticReadinessRecordKeyForSelection({
      linkedRepo: project.linkedRepo,
      linkedBranch: project.linkedBranch,
    });
    const readinessRecord = buildDiagnosticReadinessRecord({
      repo: project.linkedRepo ?? "",
      branch: project.linkedBranch ?? "",
      projectFingerprint: computeDiagnosticProjectFingerprint(project.files),
      diagnosticOk: true,
      includePipelineChecks: true,
      focusedModes: ["preview"],
    });
    const stale = FIXED_NOW - 7 * 60 * 60 * 1000;
    mockGetItem.mockImplementation(async (key: string) =>
      key === readinessKey || key.startsWith("diagnostic_readiness_record::")
        ? JSON.stringify(readinessRecord)
        : "true",
    );
    mockReadPersistedCiLiteSelection.mockResolvedValue({
      snapshot: null,
      reason: "CI-Lite ist veraltet",
      stale: true,
    });

    await expect(startBuildJob({ project, buildProfile: "preview" })).rejects.toThrow(
      /veraltet/i,
    );

    expect(mockGitHub.pushFilesToRepo).not.toHaveBeenCalled();
    expect(mockAutoFix.autoFixCIWorkflows).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
