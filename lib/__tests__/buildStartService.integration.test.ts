/**
 * Integration-ish tests for project/services/buildStartService.startBuildJob
 * Focus: build-profile normalization, fail-closed GitHub push + workflow autofix sequencing,
 * and Supabase Edge invoke payload/headers.
 */
import {
  STORAGE_KEYS,
  diagnosticLastOkKeyForSelection,
  diagnosticReadinessRecordKeyForSelection,
} from "../../lib/storageKeys";
import { computeProjectFilesSignature } from "../../lib/repoSyncOrchestration";
import { getCanonicalProjectFilesForOps } from "../../lib/getMaterializedProjectFiles";
import { makeProjectData, makeProjectFile } from "../../__tests__/helpers/projectTestHelpers";
import {
  buildDiagnosticReadinessRecord,
  computeDiagnosticProjectFingerprint,
} from "../../lib/diagnosticReadinessRecord";

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockAssertBuildReadiness = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: mockGetItem,
    setItem: mockSetItem,
  },
  getItem: mockGetItem,
  setItem: mockSetItem,
}));

jest.mock("../../lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.doMock(require.resolve("../../lib/buildReadiness"), () => {
  const actual = jest.requireActual("../../lib/buildReadiness");
  return {
    ...actual,
    assertBuildReadiness: mockAssertBuildReadiness,
  };
});

const mockGitHub = {
  getWorkflowAdminKey: jest.fn(),
  getBranchHeadSha: jest.fn(),
  pushFilesToRepo: jest.fn(),
};

const mockAutoFix = {
  autoFixCIWorkflows: jest.fn(),
};

const mockInvoke = jest.fn();

const mockSupabase: any = {
  auth: {
    getSession: jest.fn(async () => ({
      data: { session: { access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYnVpbGRfYWRtaW4iLCJzdWIiOiJ0ZXN0IiwiZXhwIjo0MTAyNDQ0ODAwfQ.c2lnbmF0dXJl" } },
    })),
  },
  functions: {
    invoke: mockInvoke,
  },
};

const ghServicePath = require.resolve("../../infra/github/githubService");
const ciAutoFixPath = require.resolve("../../lib/diagnostics/ciAutoFix");
const supabasePath = require.resolve("../../lib/supabase");

// IMPORTANT: mock by resolved absolute path so it matches any importer string.
jest.doMock(ghServicePath, () => mockGitHub);
jest.doMock(ciAutoFixPath, () => mockAutoFix);
jest.doMock(supabasePath, () => ({
  ensureSupabaseClient: jest.fn(async () => mockSupabase),
}));

// Require AFTER mocks
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { startBuildJob } = require("../../project/services/buildStartService");

function makeProject(overrides = {}) {
  return makeProjectData({
    files: [
      makeProjectFile("app.json", "{}"),
      makeProjectFile("src/index.ts", "export const x=1;"),
    ],
    linkedRepo: "k1w1-a0style/musik-player",
    linkedBranch: "main",
    ...overrides,
  });
}

function repoSyncKey(repo: string, branch: string): string {
  return `repo_sync_signature::${encodeURIComponent(repo.trim().toLowerCase())}::${encodeURIComponent(branch.trim())}`;
}

describe("startBuildJob (integration)", () => {
  const deps = {
    storageGetItem: (key: string) => mockGetItem(key),
    storageSetItem: (key: string, value: string) => mockSetItem(key, value),
    getBranchHeadSha: (owner: string, repo: string, branch: string) =>
      mockGitHub.getBranchHeadSha(owner, repo, branch),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAssertBuildReadiness.mockResolvedValue(undefined);
    mockSetItem.mockResolvedValue(undefined);
    const project = makeProject();
    const repo = "k1w1-a0style/musik-player";
    const branch = "main";
    const syncKey = repoSyncKey(repo, branch);
    const syncSig = `stale:${computeProjectFilesSignature(getCanonicalProjectFilesForOps(project))}`;
    const readinessKey = diagnosticReadinessRecordKeyForSelection({ linkedRepo: repo, linkedBranch: branch });
    const readinessRecord = buildDiagnosticReadinessRecord({
      repo,
      branch,
      projectFingerprint: computeDiagnosticProjectFingerprint(project.files),
      diagnosticOk: true,
      includePipelineChecks: true,
      focusedModes: ["preview"],
    });
    mockGetItem.mockImplementation(async (key: string) => {
      if (key.startsWith("diagnostic_last_ok::")) {
        return "true";
      }
      switch (key) {
        case readinessKey:
          return JSON.stringify(readinessRecord);
        case STORAGE_KEYS.CI_LITE_LINT_OK:
        case STORAGE_KEYS.CI_LITE_TYPECHECK_OK:
          return "true";
        case STORAGE_KEYS.CI_LITE_LAST_REPO:
          return "k1w1-a0style/musik-player";
        case STORAGE_KEYS.CI_LITE_LAST_BRANCH:
          return "main";
        case STORAGE_KEYS.CI_LITE_LAST_SHA:
          return "1111111111111111111111111111111111111111";
        case STORAGE_KEYS.CI_LITE_LAST_RUN_AT:
          return String(Date.now());
        case syncKey:
          return syncSig;
        default:
          return null;
      }
    });
    mockGitHub.getWorkflowAdminKey.mockResolvedValue("adminkey");
    mockGitHub.getBranchHeadSha.mockResolvedValue("1111111111111111111111111111111111111111");
    mockGitHub.pushFilesToRepo.mockResolvedValue(undefined);
    mockAutoFix.autoFixCIWorkflows.mockResolvedValue(undefined);

    mockInvoke.mockResolvedValue({
      data: { jobId: 42 },
      error: null,
    });
  });

  it("pushes files, ensures workflows, then invokes TRIGGER_EAS_BUILD with normalized profile", async () => {
    const project = makeProject({ linkedBranch: "main" });
    const canonicalFiles = getCanonicalProjectFilesForOps(project);
    expect(canonicalFiles).not.toEqual(project.files);
    expect(canonicalFiles.find((file) => file.path === "app.json")?.content).toContain("\"slug\": \"test\"");

    const res = await startBuildJob({ project, buildProfile: "development", deps });

    expect(mockGitHub.pushFilesToRepo).toHaveBeenCalledTimes(1);
    expect(mockGitHub.pushFilesToRepo).toHaveBeenCalledWith(
      "k1w1-a0style",
      "musik-player",
      canonicalFiles,
      "main",
    );
    expect(mockAutoFix.autoFixCIWorkflows).toHaveBeenCalledWith({
      owner: "k1w1-a0style",
      repo: "musik-player",
      branch: "main",
    });

    // Supabase edge function invoke payload + JWT/admin header
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const [fnName, opts] = mockInvoke.mock.calls[0];

    expect(typeof fnName).toBe("string");
    expect(opts?.headers?.Authorization).toBe("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYnVpbGRfYWRtaW4iLCJzdWIiOiJ0ZXN0IiwiZXhwIjo0MTAyNDQ0ODAwfQ.c2lnbmF0dXJl");
    expect(opts?.headers?.["x-k1w1-admin-key"]).toBeUndefined();
    expect(opts?.body).toEqual({
      githubRepo: "k1w1-a0style/musik-player",
      buildProfile: "development",
      branch: "main",
    });

    expect(res).toEqual({
      jobId: "42",
      githubRepo: "k1w1-a0style/musik-player",
      branch: "main",
      buildProfile: "development",
    });
  });

  it("aborts build when push fails before workflow autofix or dispatch", async () => {
    mockGitHub.pushFilesToRepo.mockRejectedValueOnce(new Error("push failed"));
    const project = makeProject({ linkedBranch: "dev" });
    const syncKey = repoSyncKey("k1w1-a0style/musik-player", "dev");
    const diagKey = diagnosticLastOkKeyForSelection({ linkedRepo: "k1w1-a0style/musik-player", linkedBranch: "dev" });
    const readinessKey = diagnosticReadinessRecordKeyForSelection({
      linkedRepo: "k1w1-a0style/musik-player",
      linkedBranch: "dev",
    });
    const syncSig = `stale:${computeProjectFilesSignature(getCanonicalProjectFilesForOps(project))}`;
    const readinessRecord = buildDiagnosticReadinessRecord({
      repo: "k1w1-a0style/musik-player",
      branch: "dev",
      projectFingerprint: computeDiagnosticProjectFingerprint(project.files),
      diagnosticOk: true,
      includePipelineChecks: true,
      focusedModes: ["preview"],
    });
    mockGetItem.mockImplementation(async (key: string) => {
      switch (key) {
        case diagKey:
        case readinessKey:
          return key === readinessKey ? JSON.stringify(readinessRecord) : "true";
        case STORAGE_KEYS.CI_LITE_LINT_OK:
        case STORAGE_KEYS.CI_LITE_TYPECHECK_OK:
          return "true";
        case STORAGE_KEYS.CI_LITE_LAST_REPO:
          return "k1w1-a0style/musik-player";
        case STORAGE_KEYS.CI_LITE_LAST_BRANCH:
          return "dev";
        case STORAGE_KEYS.CI_LITE_LAST_SHA:
          return "1111111111111111111111111111111111111111";
        case STORAGE_KEYS.CI_LITE_LAST_RUN_AT:
          return String(Date.now());
        case syncKey:
          return syncSig;
        default:
          return null;
      }
    });

    await expect(startBuildJob({ project, buildProfile: "preview", deps })).rejects.toThrow(
      /Build abgebrochen: Lokale Aenderungen konnten nicht erfolgreich ins Ziel-Repo gepusht werden\./i,
    );
    expect(mockAutoFix.autoFixCIWorkflows).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("normalizes numeric job ids from the edge function to string", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { jobId: 7 },
      error: null,
    });

    const res = await startBuildJob({
      project: makeProject(),
      buildProfile: "production",
      deps,
    });

    expect(res.jobId).toBe("7");
  });

  it("throws when edge function returns an invalid non-numeric job id", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { jobId: "not-a-number" },
      error: null,
    });

    await expect(
      startBuildJob({ project: makeProject(), buildProfile: "production", deps }),
    ).rejects.toThrow(/positive numerische ID erwartet/i);
  });

  it("skips push when local and tracked remote signature are already in sync", async () => {
    const project = makeProject();
    const syncKey = repoSyncKey("k1w1-a0style/musik-player", "main");
    const diagKey = diagnosticLastOkKeyForSelection({ linkedRepo: "k1w1-a0style/musik-player", linkedBranch: "main" });
    const syncSig = computeProjectFilesSignature(getCanonicalProjectFilesForOps(project));
    const readinessKey = diagnosticReadinessRecordKeyForSelection({
      linkedRepo: "k1w1-a0style/musik-player",
      linkedBranch: "main",
    });
    const readinessRecord = buildDiagnosticReadinessRecord({
      repo: "k1w1-a0style/musik-player",
      branch: "main",
      projectFingerprint: computeDiagnosticProjectFingerprint(project.files),
      diagnosticOk: true,
      includePipelineChecks: true,
      focusedModes: ["preview"],
    });
    mockGetItem.mockImplementation(async (key: string) => {
      switch (key) {
        case diagKey:
        case readinessKey:
          return key === readinessKey ? JSON.stringify(readinessRecord) : "true";
        case STORAGE_KEYS.CI_LITE_LINT_OK:
        case STORAGE_KEYS.CI_LITE_TYPECHECK_OK:
          return "true";
        case STORAGE_KEYS.CI_LITE_LAST_REPO:
          return "k1w1-a0style/musik-player";
        case STORAGE_KEYS.CI_LITE_LAST_BRANCH:
          return "main";
        case STORAGE_KEYS.CI_LITE_LAST_SHA:
          return "1111111111111111111111111111111111111111";
        case STORAGE_KEYS.CI_LITE_LAST_RUN_AT:
          return String(Date.now());
        case syncKey:
          return syncSig;
        default:
          return null;
      }
    });

    await startBuildJob({ project, buildProfile: "preview", deps });

    expect(mockGitHub.pushFilesToRepo).not.toHaveBeenCalled();
    expect(mockAutoFix.autoFixCIWorkflows).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it("blocks build conservatively when sync state is unknown", async () => {
    const project = makeProject({ linkedBranch: "release" });
    const diagKey = diagnosticLastOkKeyForSelection({ linkedRepo: "k1w1-a0style/musik-player", linkedBranch: "release" });
    const readinessKey = diagnosticReadinessRecordKeyForSelection({
      linkedRepo: "k1w1-a0style/musik-player",
      linkedBranch: "release",
    });
    const readinessRecord = buildDiagnosticReadinessRecord({
      repo: "k1w1-a0style/musik-player",
      branch: "release",
      projectFingerprint: computeDiagnosticProjectFingerprint(project.files),
      diagnosticOk: true,
      includePipelineChecks: true,
      focusedModes: ["preview"],
    });
    mockGetItem.mockImplementation(async (key: string) => {
      switch (key) {
        case diagKey:
        case readinessKey:
          return key === readinessKey ? JSON.stringify(readinessRecord) : "true";
        case STORAGE_KEYS.CI_LITE_LINT_OK:
        case STORAGE_KEYS.CI_LITE_TYPECHECK_OK:
          return "true";
        case STORAGE_KEYS.CI_LITE_LAST_REPO:
          return "k1w1-a0style/musik-player";
        case STORAGE_KEYS.CI_LITE_LAST_BRANCH:
          return "release";
        case STORAGE_KEYS.CI_LITE_LAST_SHA:
          return "1111111111111111111111111111111111111111";
        case STORAGE_KEYS.CI_LITE_LAST_RUN_AT:
          return String(Date.now());
        default:
          return null;
      }
    });

    await expect(startBuildJob({ project, buildProfile: "preview", deps })).rejects.toThrow(/Sync-Status/i);
    expect(mockGitHub.pushFilesToRepo).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("fails closed when raw source files contain conflicting canonical duplicates", async () => {
    const project = makeProject({
      files: [
        makeProjectFile("src/App.tsx", "export default 1;"),
        makeProjectFile("./src//App.tsx", "export default 2;"),
      ],
    });
    const repo = "k1w1-a0style/musik-player";
    const branch = "main";
    const diagKey = diagnosticLastOkKeyForSelection({ linkedRepo: repo, linkedBranch: branch });
    const readinessKey = diagnosticReadinessRecordKeyForSelection({
      linkedRepo: repo,
      linkedBranch: branch,
    });
    const syncKey = repoSyncKey(repo, branch);
    const readinessRecord = buildDiagnosticReadinessRecord({
      repo,
      branch,
      projectFingerprint: computeDiagnosticProjectFingerprint(project.files),
      diagnosticOk: true,
      includePipelineChecks: true,
      focusedModes: ["preview"],
    });
    const syncSig = computeProjectFilesSignature(getCanonicalProjectFilesForOps(project));
    mockGetItem.mockImplementation(async (key: string) => {
      switch (key) {
        case diagKey:
        case readinessKey:
          return key === readinessKey ? JSON.stringify(readinessRecord) : "true";
        case STORAGE_KEYS.CI_LITE_LINT_OK:
        case STORAGE_KEYS.CI_LITE_TYPECHECK_OK:
          return "true";
        case STORAGE_KEYS.CI_LITE_LAST_REPO:
          return repo;
        case STORAGE_KEYS.CI_LITE_LAST_BRANCH:
          return branch;
        case STORAGE_KEYS.CI_LITE_LAST_SHA:
          return "1111111111111111111111111111111111111111";
        case STORAGE_KEYS.CI_LITE_LAST_RUN_AT:
          return String(Date.now());
        case syncKey:
          return syncSig;
        default:
          return null;
      }
    });

    await expect(startBuildJob({ project, buildProfile: "preview", deps })).rejects.toThrow(/Sync-Status/i);
    expect(mockGitHub.pushFilesToRepo).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("blocks build when no session JWT is available", async () => {
    mockSupabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } });

    await expect(startBuildJob({ project: makeProject(), buildProfile: "preview", deps })).rejects.toThrow(
      /Supabase-Anon-Key fehlt|Operator-Rolle|build_admin/i,
    );
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
