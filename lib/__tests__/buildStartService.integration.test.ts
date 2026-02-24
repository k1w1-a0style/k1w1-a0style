/**
 * Integration-ish tests for project/services/buildStartService.startBuildJob
 * Focus: build-profile normalization, GitHub push + workflow autofix sequencing,
 * and Supabase Edge invoke payload/headers.
 */
import type { ProjectData } from "../../shared/types/project";

jest.mock("../../lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockGitHub = {
  getEdgeAdminKey: jest.fn(),
  getDefaultBranch: jest.fn(),
  pushFilesToRepo: jest.fn(),
};

const mockAutoFix = {
  autoFixCIWorkflows: jest.fn(),
};

const mockInvoke = jest.fn();

const mockSupabase = {
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

function makeProject(overrides: Partial<ProjectData> = {}): ProjectData {
  return {
    id: "p1",
    name: "test",
    files: [
      { path: "app.json", content: "{}", updatedAt: Date.now() } as any,
      { path: "src/index.ts", content: "export const x=1;", updatedAt: Date.now() } as any,
    ],
    linkedRepo: "k1w1-a0style/musik-player",
    linkedBranch: "",
    ...overrides,
  } as any;
}

describe("startBuildJob (integration)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGitHub.getEdgeAdminKey.mockResolvedValue("adminkey");
    mockGitHub.getDefaultBranch.mockResolvedValue("main");
    mockGitHub.pushFilesToRepo.mockResolvedValue(undefined);
    mockAutoFix.autoFixCIWorkflows.mockResolvedValue(undefined);

    mockInvoke.mockResolvedValue({
      data: { jobId: "11111111-1111-1111-1111-111111111111" },
      error: null,
    });
  });

  it("pushes files, ensures workflows, then invokes TRIGGER_EAS_BUILD with normalized profile", async () => {
    const project = makeProject({ linkedBranch: "" });

    const res = await startBuildJob({ project, buildProfile: "development" });

    expect(mockGitHub.getDefaultBranch).toHaveBeenCalledWith("k1w1-a0style", "musik-player");
    expect(mockGitHub.pushFilesToRepo).toHaveBeenCalledTimes(1);
    expect(mockAutoFix.autoFixCIWorkflows).toHaveBeenCalledWith({
      owner: "k1w1-a0style",
      repo: "musik-player",
      branch: "main",
    });

    // Supabase edge function invoke payload + admin header
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const [fnName, opts] = mockInvoke.mock.calls[0];

    expect(typeof fnName).toBe("string");
    expect(opts?.headers?.["x-k1w1-admin-key"]).toBe("adminkey");
    expect(opts?.body).toEqual({
      githubRepo: "k1w1-a0style/musik-player",
      buildProfile: "development",
      branch: "main",
    });

    expect(res).toEqual({
      jobId: "11111111-1111-1111-1111-111111111111",
      githubRepo: "k1w1-a0style/musik-player",
      branch: "main",
      buildProfile: "development",
    });
  });

  it("falls back to existing linkedBranch when push fails", async () => {
    mockGitHub.pushFilesToRepo.mockRejectedValueOnce(new Error("push failed"));
    const project = makeProject({ linkedBranch: "dev" });

    const res = await startBuildJob({ project, buildProfile: "preview" });

    // still attempts autofix with derived owner/repo and branch hint (dev)
    expect(mockAutoFix.autoFixCIWorkflows).toHaveBeenCalledWith({
      owner: "k1w1-a0style",
      repo: "musik-player",
      branch: "dev",
    });

    const [, opts] = mockInvoke.mock.calls[0];
    expect(opts.body.branch).toBe("dev");
    expect(res.branch).toBe("dev");
  });

  it("throws when edge function returns a non-uuid job id", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { jobId: "not-a-uuid" },
      error: null,
    });

    await expect(
      startBuildJob({ project: makeProject(), buildProfile: "production" }),
    ).rejects.toThrow(/ungueltige Job-ID/i);
  });
});
