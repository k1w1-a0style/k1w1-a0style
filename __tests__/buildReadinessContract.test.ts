import { evaluateBuildReadiness } from "../lib/buildReadiness";
import { ciLiteSnapshotKeyForSelection } from "../lib/storageKeys";
import type { ProjectData } from "../shared/types/project";

const NOW = 1_710_000_000_000;
const SHA = "a".repeat(40);

function makeProject(overrides: Partial<ProjectData> = {}): ProjectData {
  return {
    id: "p1",
    name: "test",
    files: [{ path: "app.json", content: "{}", updatedAt: NOW } as any],
    linkedRepo: "owner/repo",
    linkedBranch: "main",
    ...overrides,
  } as any;
}

function buildScopedGreenStorageMap(params: {
  repo?: string;
  branch?: string;
  snapshotOverrides?: Record<string, unknown>;
  diagnosticValue?: string;
} = {}): Record<string, string | null> {
  const repo = params.repo ?? "owner/repo";
  const branch = params.branch ?? "main";
  return {
    [`diagnostic_last_ok::${encodeURIComponent(repo)}::${encodeURIComponent(branch)}`]:
      params.diagnosticValue ?? "true",
    [ciLiteSnapshotKeyForSelection({ linkedRepo: repo, linkedBranch: branch })]: JSON.stringify({
      repo,
      branch,
      sha: SHA,
      runAtMs: NOW,
      workflowId: "k1w1-ci-lite.yml",
      jobId: "job-123",
      runId: 321,
      conclusion: "success",
      lintOk: true,
      typecheckOk: true,
      ...(params.snapshotOverrides ?? {}),
    }),
  };
}

describe("evaluateBuildReadiness", () => {
  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns a structured ok result when diagnostics and CI-Lite gates are green", async () => {
    const storageMap = buildScopedGreenStorageMap();

    const result = await evaluateBuildReadiness(makeProject(), {
      storageGetItem: async (key: string) => storageMap[key] ?? null,
      getBranchHeadSha: async () => SHA,
    });

    expect(result).toMatchObject({
      ok: true,
      reasonCode: null,
      message: null,
      context: {
        linkedRepo: "owner/repo",
        linkedBranch: "main",
        diagnosticOk: true,
      },
      snapshot: {
        repo: "owner/repo",
        branch: "main",
        sha: SHA,
        conclusion: "success",
      },
    });
  });

  it("returns invalid_repo for malformed repo selections", async () => {
    const result = await evaluateBuildReadiness(makeProject({ linkedRepo: "broken-repo" }), {
      storageGetItem: async () => null,
    });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      reasonCode: "invalid_repo",
      message:
        'Kein gueltiges Ziel-Repo verknuepft. Bitte in "Connections" ein Repo auswaehlen.',
    });
  });

  it("returns missing_branch when no linked branch is selected", async () => {
    const result = await evaluateBuildReadiness(makeProject({ linkedBranch: "" }), {
      storageGetItem: async () => null,
    });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      reasonCode: "missing_branch",
      message: "Branch fehlt (im Repo-Screen auswaehlen)",
    });
  });

  it("returns diagnostic_not_green when the diagnostic gate is not verified", async () => {
    const storageMap = buildScopedGreenStorageMap({ diagnosticValue: "false" });

    const result = await evaluateBuildReadiness(makeProject(), {
      storageGetItem: async (key: string) => storageMap[key] ?? null,
    });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      reasonCode: "diagnostic_not_green",
      message: "Diagnostik nicht gruen – im Diagnostic-Screen ausfuehren",
    });
  });

  it("returns ci_lite_stale when the persisted CI-Lite snapshot is too old", async () => {
    const storageMap = buildScopedGreenStorageMap({
      snapshotOverrides: { runAtMs: NOW - 7 * 60 * 60 * 1000 },
    });

    const result = await evaluateBuildReadiness(makeProject(), {
      storageGetItem: async (key: string) => storageMap[key] ?? null,
      getBranchHeadSha: async () => SHA,
    });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      reasonCode: "ci_lite_stale",
      message: "CI-Lite ist veraltet",
    });
  });

  it("returns ci_lite_sha_mismatch when the branch head changed after the last CI-Lite run", async () => {
    const storageMap = buildScopedGreenStorageMap();

    const result = await evaluateBuildReadiness(makeProject(), {
      storageGetItem: async (key: string) => storageMap[key] ?? null,
      getBranchHeadSha: async () => "b".repeat(40),
    });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      reasonCode: "ci_lite_sha_mismatch",
      message: "Repo/Branch wurden seit dem letzten CI-Lite-Run geaendert (SHA-Mismatch)",
    });
  });
});
