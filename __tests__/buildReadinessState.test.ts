import { readBuildReadinessState } from "../screens/EnhancedBuildScreen/hooks/buildReadinessState";

jest.mock("libsodium-wrappers-sumo", () => ({}), { virtual: true });

describe("readBuildReadinessState", () => {
  it("marks CI-Lite as blocked when the recorded SHA is missing", async () => {
    const now = Date.now();
    const storageMap: Record<string, string> = {
      "diagnostic_readiness_record::owner%2Frepo::main": JSON.stringify({
        version: 1,
        repo: "owner/repo",
        branch: "main",
        diagnosticOk: true,
        includePipelineChecks: true,
        focusedModes: ["preview"],
        checkedAt: new Date(now).toISOString(),
      }),
      ci_lite_lint_ok: "true",
      ci_lite_typecheck_ok: "true",
      ci_lite_last_repo: "owner/repo",
      ci_lite_last_branch: "main",
      ci_lite_last_run_at: String(now),
    };

    const result = await readBuildReadinessState({
      repoFullName: "owner/repo",
      branchName: "main",
      deps: {
        storageGetItem: async (key: string) => storageMap[key] ?? null,
        readBranchHeadSha: async () => "a".repeat(40),
      },
    });

    expect(result.hasDiagOk).toBe(true);
    expect(result.hasCiLiteOk).toBe(false);
    expect(result.ciLiteState).toBe("unknown");
    expect(result.ciLiteReason).toBe("CI-Lite-SHA fehlt oder ist ungueltig");
  });

  it("marks CI-Lite as blocked when branch HEAD changed since the last green run", async () => {
    const now = Date.now();
    const storageMap: Record<string, string> = {
      "diagnostic_readiness_record::owner%2Frepo::main": JSON.stringify({
        version: 1,
        repo: "owner/repo",
        branch: "main",
        diagnosticOk: true,
        includePipelineChecks: true,
        focusedModes: ["preview"],
        checkedAt: new Date(now).toISOString(),
      }),
      ci_lite_lint_ok: "true",
      ci_lite_typecheck_ok: "true",
      ci_lite_last_repo: "owner/repo",
      ci_lite_last_branch: "main",
      ci_lite_last_run_at: String(now),
      ci_lite_last_sha: "a".repeat(40),
    };

    const result = await readBuildReadinessState({
      repoFullName: "owner/repo",
      branchName: "main",
      deps: {
        storageGetItem: async (key: string) => storageMap[key] ?? null,
        readBranchHeadSha: async () => "b".repeat(40),
      },
    });

    expect(result.hasDiagOk).toBe(true);
    expect(result.hasCiLiteOk).toBe(false);
    expect(result.ciLiteState).toBe("unknown");
    expect(result.ciLiteReason).toMatch(/SHA-Mismatch/);
  });

  it("does not inherit a green legacy diagnostic flag for another selection", async () => {
    const now = Date.now();
    const storageMap: Record<string, string> = {
      diagnostic_last_ok: "true",
      ci_lite_lint_ok: "true",
      ci_lite_typecheck_ok: "true",
      ci_lite_last_repo: "owner/repo",
      ci_lite_last_branch: "main",
      ci_lite_last_run_at: String(now),
      ci_lite_last_sha: "a".repeat(40),
    };

    const result = await readBuildReadinessState({
      repoFullName: "owner/repo",
      branchName: "main",
      deps: {
        storageGetItem: async (key: string) => storageMap[key] ?? null,
        readBranchHeadSha: async () => "a".repeat(40),
      },
    });

    expect(result.hasDiagOk).toBe(false);
    expect(result.diagnosticState).toBe("unknown");
    expect(result.diagnosticReason).toMatch(/noch nicht sicher bestaetigt/i);
  });

  it("keeps stale CI-Lite as an uncertain state instead of hard missing", async () => {
    const staleRunAt = Date.now() - 7 * 60 * 60 * 1000;
    const storageMap: Record<string, string> = {
      "diagnostic_last_ok::owner%2Frepo::main": "false",
      ci_lite_lint_ok: "true",
      ci_lite_typecheck_ok: "true",
      ci_lite_last_repo: "owner/repo",
      ci_lite_last_branch: "main",
      ci_lite_last_run_at: String(staleRunAt),
      ci_lite_last_sha: "a".repeat(40),
    };

    const result = await readBuildReadinessState({
      repoFullName: "owner/repo",
      branchName: "main",
      deps: {
        storageGetItem: async (key: string) => storageMap[key] ?? null,
        readBranchHeadSha: async () => "a".repeat(40),
      },
    });

    expect(result.hasDiagOk).toBe(false);
    expect(result.diagnosticState).toBe("unknown");
    expect(result.diagnosticReason).toMatch(/noch nicht sicher bestaetigt/i);
    expect(result.hasCiLiteOk).toBe(false);
    expect(result.ciLiteState).toBe("stale");
    expect(result.ciLiteStale).toBe(true);
    expect(result.ciLiteReason).toBe("CI-Lite ist veraltet");
  });

  it("keeps CI-Lite green when repo, branch, freshness and SHA all match", async () => {
    const now = Date.now();
    const sha = "c".repeat(40);
    const storageMap: Record<string, string> = {
      "diagnostic_readiness_record::owner%2Frepo::main": JSON.stringify({
        version: 1,
        repo: "owner/repo",
        branch: "main",
        diagnosticOk: true,
        includePipelineChecks: true,
        focusedModes: ["preview"],
        checkedAt: new Date(now).toISOString(),
      }),
      ci_lite_lint_ok: "true",
      ci_lite_typecheck_ok: "true",
      ci_lite_last_repo: "owner/repo",
      ci_lite_last_branch: "main",
      ci_lite_last_run_at: String(now),
      ci_lite_last_sha: sha,
    };

    const result = await readBuildReadinessState({
      repoFullName: "owner/repo",
      branchName: "main",
      deps: {
        storageGetItem: async (key: string) => storageMap[key] ?? null,
        readBranchHeadSha: async () => sha,
      },
    });

    expect(result.hasDiagOk).toBe(true);
    expect(result.hasCiLiteOk).toBe(true);
    expect(result.diagnosticState).toBe("verified");
    expect(result.ciLiteState).toBe("verified");
    expect(result.ciLiteReason).toBeNull();
    expect(result.ciLiteStale).toBe(false);
  });

  it("blocks diagnostic readiness when record exists but pipeline checks were excluded", async () => {
    const storageMap: Record<string, string> = {
      "diagnostic_readiness_record::owner%2Frepo::main": JSON.stringify({
        version: 1,
        repo: "owner/repo",
        branch: "main",
        diagnosticOk: true,
        includePipelineChecks: false,
        focusedModes: ["preview"],
        checkedAt: new Date().toISOString(),
      }),
    };

    const result = await readBuildReadinessState({
      repoFullName: "owner/repo",
      branchName: "main",
      deps: {
        storageGetItem: async (key: string) => storageMap[key] ?? null,
        readBranchHeadSha: async () => "a".repeat(40),
      },
    });

    expect(result.hasDiagOk).toBe(false);
    expect(result.diagnosticReason).toMatch(/ohne Pipeline-Checks/i);
  });

  it("reports diagnostic storage read failures as unreadable instead of never-run", async () => {
    const now = Date.now();
    const storageMap: Record<string, string> = {
      ci_lite_lint_ok: "true",
      ci_lite_typecheck_ok: "true",
      ci_lite_last_repo: "owner/repo",
      ci_lite_last_branch: "main",
      ci_lite_last_run_at: String(now),
      ci_lite_last_sha: "a".repeat(40),
    };

    const result = await readBuildReadinessState({
      repoFullName: "owner/repo",
      branchName: "main",
      deps: {
        storageGetItem: async (key: string) => {
          if (key.includes("diagnostic")) throw new Error("storage down");
          return storageMap[key] ?? null;
        },
        readBranchHeadSha: async () => "a".repeat(40),
      },
    });

    expect(result.hasDiagOk).toBe(false);
    expect(result.diagnosticState).toBe("unknown");
    expect(String(result.diagnosticReason || "")).toMatch(/nicht gelesen werden/i);
    expect(String(result.diagnosticReason || "")).not.toMatch(/noch nicht sicher bestaetigt/i);
    expect(result.hasCiLiteOk).toBe(true);
  });

  it("reports CI-Lite read failures explicitly while keeping stale semantics intact", async () => {
    const result = await readBuildReadinessState({
      repoFullName: "owner/repo",
      branchName: "main",
      deps: {
        storageGetItem: async (key: string) => {
          if (key.startsWith("ci_lite_")) throw new Error("io error");
          return "true";
        },
        readBranchHeadSha: async () => "a".repeat(40),
      },
    });

    expect(result.hasCiLiteOk).toBe(false);
    expect(result.ciLiteState).toBe("unknown");
    expect(String(result.ciLiteReason || "")).toMatch(/nicht gelesen werden/i);
  });
});
