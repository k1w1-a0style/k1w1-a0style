import { readPersistedCiLiteSelection } from "../lib/ciLitePersistence";

const NOW = 1_710_000_000_000;
const SHA = "a".repeat(40);

function buildStorageMap(overrides: Record<string, string | null> = {}): Record<string, string | null> {
  return {
    ci_lite_lint_ok: "true",
    ci_lite_typecheck_ok: "true",
    ci_lite_last_run_at: String(NOW),
    ci_lite_last_repo: "owner/repo",
    ci_lite_last_branch: "main",
    ci_lite_last_sha: SHA,
    ci_lite_last_workflow: "k1w1-ci-lite.yml",
    ci_lite_last_job_id: "job-123",
    ci_lite_last_run_id: "321",
    ci_lite_last_conclusion: "success",
    ...overrides,
  };
}

describe("readPersistedCiLiteSelection", () => {
  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("accepts a fresh persisted CI-Lite snapshot when repo, branch and SHA all match", async () => {
    const storageMap = buildStorageMap();

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
    ["repo", { ci_lite_last_repo: "other/repo" }, "CI-Lite gehoert zu anderem Repo"],
    ["branch", { ci_lite_last_branch: "release" }, "CI-Lite gehoert zu anderem Branch"],
    ["sha", {}, "Repo/Branch wurden seit dem letzten CI-Lite-Run geaendert (SHA-Mismatch)", "b".repeat(40)],
  ])("rejects persisted state when %s no longer matches the current selection", async (_kind, overrides, expectedReason, headSha = SHA) => {
    const storageMap = buildStorageMap(overrides as Record<string, string | null>);

    const result = await readPersistedCiLiteSelection({
      repoFullName: "owner/repo",
      branchName: "main",
      deps: {
        storageGetItem: async (key: string) => storageMap[key] ?? null,
        readBranchHeadSha: async () => headSha,
      },
    });

    expect(result.snapshot).toBeNull();
    expect(result.reason).toBe(expectedReason);
  });

  it("rejects stale persisted state based on freshness", async () => {
    const storageMap = buildStorageMap({
      ci_lite_last_run_at: String(NOW - (7 * 60 * 60 * 1000)),
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
    expect(result.reason).toBe("CI-Lite ist veraltet");
    expect(result.stale).toBe(true);
  });
});
