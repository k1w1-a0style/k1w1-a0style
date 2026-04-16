import { assertBuildReadiness } from "../project/services/buildStartService";
import { computeDiagnosticProjectFingerprint } from "../lib/diagnosticReadinessRecord";
import { makeProjectData } from "./helpers/projectTestHelpers";

jest.mock("libsodium-wrappers-sumo", () => ({}), { virtual: true });

function makeProject(overrides = {}) {
  return makeProjectData({
    linkedRepo: "k1w1-a0style/musik-player",
    linkedBranch: "main",
    ...overrides,
  });
}

describe("build readiness gate - diagnostic scoped selection", () => {
  it("accepts a green repo/branch-scoped diagnostic flag even when legacy key is false", async () => {
    const now = Date.now();
    const storageMap: Record<string, string> = {
      "diagnostic_readiness_record::k1w1-a0style%2Fmusik-player::main": JSON.stringify({
        version: 2,
        repo: "k1w1-a0style/musik-player",
        branch: "main",
        projectFingerprint: computeDiagnosticProjectFingerprint(makeProject().files),
        diagnosticOk: true,
        includePipelineChecks: true,
        focusedModes: ["preview"],
        checkedAt: new Date(now).toISOString(),
      }),
      diagnostic_last_ok: "false",
      ci_lite_lint_ok: "true",
      ci_lite_typecheck_ok: "true",
      ci_lite_last_run_at: String(now),
      ci_lite_last_repo: "k1w1-a0style/musik-player",
      ci_lite_last_branch: "main",
      ci_lite_last_sha: "a".repeat(40),
    };

    await expect(
      assertBuildReadiness(makeProject(), {
        storageGetItem: async (key: string) => storageMap[key] ?? null,
        getBranchHeadSha: async () => "a".repeat(40),
      }),
    ).resolves.toBeUndefined();
  });

  it("blocks when the scoped diagnostic flag is missing even if a legacy global flag is green", async () => {
    const now = Date.now();
    const storageMap: Record<string, string> = {
      diagnostic_last_ok: "true",
      ci_lite_lint_ok: "true",
      ci_lite_typecheck_ok: "true",
      ci_lite_last_run_at: String(now),
      ci_lite_last_repo: "k1w1-a0style/musik-player",
      ci_lite_last_branch: "main",
      ci_lite_last_sha: "c".repeat(40),
    };

    await expect(
      assertBuildReadiness(makeProject(), {
        storageGetItem: async (key: string) => storageMap[key] ?? null,
        getBranchHeadSha: async () => "c".repeat(40),
      }),
    ).rejects.toThrow(/diagnostic_not_green|diagnostik nicht gruen/i);
  });

  it("still blocks when scoped and legacy diagnostic flags are both non-green", async () => {
    const now = Date.now();
    const storageMap: Record<string, string> = {
      diagnostic_last_ok: "false",
      ci_lite_lint_ok: "true",
      ci_lite_typecheck_ok: "true",
      ci_lite_last_run_at: String(now),
      ci_lite_last_repo: "k1w1-a0style/musik-player",
      ci_lite_last_branch: "main",
      ci_lite_last_sha: "b".repeat(40),
    };

    await expect(
      assertBuildReadiness(makeProject(), {
        storageGetItem: async (key: string) => storageMap[key] ?? null,
        getBranchHeadSha: async () => "b".repeat(40),
      }),
    ).rejects.toThrow(/diagnostic_not_green/);
  });

  it("blocks when structured record omits pipeline checks even if legacy scoped flag is true", async () => {
    const now = Date.now();
    const storageMap: Record<string, string> = {
      "diagnostic_readiness_record::k1w1-a0style%2Fmusik-player::main": JSON.stringify({
        version: 2,
        repo: "k1w1-a0style/musik-player",
        branch: "main",
        projectFingerprint: computeDiagnosticProjectFingerprint(makeProject().files),
        diagnosticOk: true,
        includePipelineChecks: false,
        focusedModes: ["preview"],
        checkedAt: new Date(now).toISOString(),
      }),
      "diagnostic_last_ok::k1w1-a0style%2Fmusik-player::main": "true",
      ci_lite_lint_ok: "true",
      ci_lite_typecheck_ok: "true",
      ci_lite_last_run_at: String(now),
      ci_lite_last_repo: "k1w1-a0style/musik-player",
      ci_lite_last_branch: "main",
      ci_lite_last_sha: "d".repeat(40),
    };

    await expect(
      assertBuildReadiness(makeProject(), {
        storageGetItem: async (key: string) => storageMap[key] ?? null,
        getBranchHeadSha: async () => "d".repeat(40),
      }),
    ).rejects.toThrow(/diagnostic_not_green/i);
  });
});
