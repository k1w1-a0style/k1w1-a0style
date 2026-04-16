import type { ProjectData } from "../shared/types/project";
import { buildDiagnosticReadinessRecord, computeDiagnosticProjectFingerprint } from "../lib/diagnosticReadinessRecord";
import { diagnosticReadinessRecordKeyForSelection } from "../lib/storageKeys";

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: (...args: unknown[]) => mockGetItem(...args),
  setItem: (...args: unknown[]) => mockSetItem(...args),
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
jest.doMock(require.resolve("../lib/repoSyncOrchestration"), () => ({
  getRepoSyncState: jest.fn(async () => "in_sync"),
  markRepoSyncSignature: jest.fn(async () => undefined),
  hasConflictingCanonicalFileVariants: jest.fn(() => false),
}));
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

function makeProject(overrides: Partial<ProjectData> = {}): ProjectData {
  return {
    id: "p1",
    name: "test",
    files: [{ path: "app.json", content: "{}" }],
    chatHistory: [],
    createdAt: new Date(0).toISOString(),
    lastModified: new Date(0).toISOString(),
    linkedRepo: "k1w1-a0style/musik-player",
    linkedBranch: "main",
    ...overrides,
  };
}

describe("buildStartService edge payload typing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const now = Date.now();
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
    mockGetItem.mockImplementation(async (key: string) => ({
      "diagnostic_last_ok::k1w1-a0style%2Fmusik-player::main": "true",
      [readinessKey]: JSON.stringify(readinessRecord),
      ci_lite_lint_ok: "true",
      ci_lite_typecheck_ok: "true",
      ci_lite_last_run_at: String(now),
      ci_lite_last_repo: "k1w1-a0style/musik-player",
      ci_lite_last_branch: "main",
      ci_lite_last_sha: "0123456789abcdef0123456789abcdef01234567",
    }[key] ?? null));

    mockGitHub.getWorkflowAdminKey.mockResolvedValue("adminkey");
    mockGitHub.getBranchHeadSha.mockResolvedValue("0123456789abcdef0123456789abcdef01234567");
    mockGitHub.pushFilesToRepo.mockResolvedValue(undefined);
    mockAutoFix.autoFixCIWorkflows.mockResolvedValue(undefined);
  });

  it("maps nested job.id without any-casts", async () => {
    mockInvoke.mockResolvedValue({ data: { job: { id: 777 } }, error: null });

    await expect(startBuildJob({ project: makeProject(), buildProfile: "preview" })).resolves.toMatchObject({
      jobId: "777",
    });
  });

  it("throws edge error when payload is error-shaped with details message", async () => {
    mockInvoke.mockResolvedValue({ data: { ok: false, details: { message: "dispatch failed" } }, error: null });

    await expect(startBuildJob({ project: makeProject(), buildProfile: "preview" })).rejects.toThrow("dispatch failed");
  });
});
