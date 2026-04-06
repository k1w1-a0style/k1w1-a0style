import {
  buildPersistCiLiteEntries,
  CI_LITE_PERSISTENCE_REASONS,
  CI_LITE_WORKFLOW_ID,
  readPersistedCiLiteSelection,
} from "../lib/ciLitePersistence";
import { ciLiteSnapshotKeyForSelection } from "../lib/storageKeys";

const NOW = 1_710_000_000_000;
const SHA = "a".repeat(40);

function buildLegacyStorageMap(overrides: Record<string, string | null> = {}): Record<string, string | null> {
  return {
    ci_lite_lint_ok: "true",
    ci_lite_typecheck_ok: "true",
    ci_lite_last_run_at: String(NOW),
    ci_lite_last_repo: "owner/repo",
    ci_lite_last_branch: "main",
    ci_lite_last_sha: SHA,
    ci_lite_last_workflow: CI_LITE_WORKFLOW_ID,
    ci_lite_last_job_id: "job-123",
    ci_lite_last_run_id: "321",
    ci_lite_last_conclusion: "success",
    ...overrides,
  };
}

function buildScopedStorageMap(params: {
  repo?: string;
  branch?: string;
  overrides?: Record<string, unknown>;
} = {}): Record<string, string | null> {
  const repo = params.repo ?? "owner/repo";
  const branch = params.branch ?? "main";
  return {
    [ciLiteSnapshotKeyForSelection({ linkedRepo: repo, linkedBranch: branch })]: JSON.stringify({
      repo,
      branch,
      sha: SHA,
      runAtMs: NOW,
      workflowId: CI_LITE_WORKFLOW_ID,
      jobId: "job-123",
      runId: 321,
      conclusion: "success",
      lintOk: true,
      typecheckOk: true,
      ...(params.overrides ?? {}),
    }),
  };
}

describe("readPersistedCiLiteSelection", () => {
  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("prefers a fresh repo/branch-scoped snapshot when repo, branch and SHA all match", async () => {
    const storageMap = buildScopedStorageMap();

    const result = await readPersistedCiLiteSelection({
      repoFullName: "owner/repo",
      branchName: "main",
      deps: {
        storageGetItem: async (key: string) => storageMap[key] ?? null,
        readBranchHeadSha: async () => SHA,
      },
    });

    expect(result.reason).toBeNull();
    expect(result.stale).toBe(false);
    expect(result.snapshot).toMatchObject({
      repo: "owner/repo",
      branch: "main",
      sha: SHA,
      runId: 321,
      jobId: "job-123",
      conclusion: "success",
      lintOk: true,
      typecheckOk: true,
    });
  });

  it.each([
    {
      label: "repo mismatches the selected repo",
      overrides: { repo: "other/repo" },
      expectedReason: CI_LITE_PERSISTENCE_REASONS.REPO_MISMATCH,
    },
    {
      label: "branch mismatches the selected branch",
      overrides: { branch: "release" },
      expectedReason: CI_LITE_PERSISTENCE_REASONS.BRANCH_MISMATCH,
    },
  ])("rejects a scoped snapshot when the persisted $label", async ({ overrides, expectedReason }) => {
    const storageMap = buildScopedStorageMap({ overrides });

    const result = await readPersistedCiLiteSelection({
      repoFullName: "owner/repo",
      branchName: "main",
      deps: {
        storageGetItem: async (key: string) => storageMap[key] ?? null,
      },
    });

    expect(result.snapshot).toBeNull();
    expect(result.reason).toBe(expectedReason);
  });

  it("falls back to legacy global keys when no scoped snapshot exists", async () => {
    const storageMap = buildLegacyStorageMap();

    const result = await readPersistedCiLiteSelection({
      repoFullName: "owner/repo",
      branchName: "main",
      deps: {
        storageGetItem: async (key: string) => storageMap[key] ?? null,
        readBranchHeadSha: async () => SHA,
      },
    });

    expect(result.reason).toBeNull();
    expect(result.snapshot).toMatchObject({
      repo: "owner/repo",
      branch: "main",
      sha: SHA,
      runId: 321,
      conclusion: "success",
    });
  });

  it("rejects stale persisted state based on freshness", async () => {
    const storageMap = buildScopedStorageMap({
      overrides: { runAtMs: NOW - (7 * 60 * 60 * 1000) },
    });

    const result = await readPersistedCiLiteSelection({
      repoFullName: "owner/repo",
      branchName: "main",
      deps: {
        storageGetItem: async (key: string) => storageMap[key] ?? null,
        readBranchHeadSha: async () => SHA,
      },
    });

    expect(result.snapshot).toBeNull();
    expect(result.reason).toBe(CI_LITE_PERSISTENCE_REASONS.STALE);
    expect(result.stale).toBe(true);
  });

  it("rejects persisted state with invalid timestamps before freshness handling", async () => {
    const storageMap = buildScopedStorageMap({
      overrides: { runAtMs: "not-a-number" },
    });

    const result = await readPersistedCiLiteSelection({
      repoFullName: "owner/repo",
      branchName: "main",
      deps: {
        storageGetItem: async (key: string) => storageMap[key] ?? null,
      },
    });

    expect(result.snapshot).toBeNull();
    expect(result.reason).toBe(CI_LITE_PERSISTENCE_REASONS.INVALID_TIMESTAMP);
    expect(result.stale).toBe(false);
  });

  it("rejects incomplete or corrupt scoped persistence instead of treating it as green", async () => {
    const storageMap = buildScopedStorageMap({
      overrides: {
        lintOk: "true",
        sha: "not-a-sha",
      },
    });

    const result = await readPersistedCiLiteSelection({
      repoFullName: "owner/repo",
      branchName: "main",
      deps: {
        storageGetItem: async (key: string) => storageMap[key] ?? null,
      },
    });

    expect(result.snapshot).toBeNull();
    expect(result.reason).toBe(CI_LITE_PERSISTENCE_REASONS.LINT_TYPECHECK_UNCLEAR);
  });

  it("rejects persisted state when the current branch head SHA changed", async () => {
    const storageMap = buildScopedStorageMap();

    const result = await readPersistedCiLiteSelection({
      repoFullName: "owner/repo",
      branchName: "main",
      deps: {
        storageGetItem: async (key: string) => storageMap[key] ?? null,
        readBranchHeadSha: async () => "b".repeat(40),
      },
    });

    expect(result.snapshot).toBeNull();
    expect(result.reason).toBe(CI_LITE_PERSISTENCE_REASONS.SHA_MISMATCH);
  });
});

describe("buildPersistCiLiteEntries", () => {
  it("writes a scoped snapshot and keeps the legacy mirror for migration", () => {
    const entries = buildPersistCiLiteEntries({
      snapshot: {
        repo: "Owner/Repo",
        branch: "main",
        sha: SHA.toUpperCase(),
        runAtMs: NOW,
        workflowId: CI_LITE_WORKFLOW_ID,
        jobId: "job-123",
        runId: 321,
        conclusion: "success",
        lintOk: true,
        typecheckOk: true,
      },
    });

    expect(entries).toEqual(
      expect.arrayContaining([
        [
          ciLiteSnapshotKeyForSelection({ linkedRepo: "Owner/Repo", linkedBranch: "main" }),
          JSON.stringify({
            repo: "Owner/Repo",
            branch: "main",
            sha: SHA,
            runAtMs: NOW,
            workflowId: CI_LITE_WORKFLOW_ID,
            jobId: "job-123",
            runId: 321,
            conclusion: "success",
            lintOk: true,
            typecheckOk: true,
          }),
        ],
        ["ci_lite_last_repo", "Owner/Repo"],
        ["ci_lite_last_branch", "main"],
      ]),
    );
  });
});
