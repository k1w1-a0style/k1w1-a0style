import {
  analyzePatchRisk,
  checkPatchLimits,
  DEFAULT_PATCH_LIMITS,
  patchFingerprint,
  summarizeBatchLimits,
  summarizeBatchRisk,
} from "../diagnostics/fixSafety";
import { makePreflightPatch } from "../../__tests__/helpers/preflightTestHelpers";

describe("diagnostics/fixSafety", () => {
  test("patchFingerprint is stable across ordering of paths", () => {
    const p1 = {
      upsert: [{ path: "b.txt", content: "x" }, { path: "a.txt", content: "y" }],
      delete: [],
      jsonMerge: [],
    };

    const p2 = {
      upsert: [{ path: "a.txt", content: "y" }, { path: "b.txt", content: "x" }],
      delete: [],
      jsonMerge: [],
    };

    expect(patchFingerprint(makePreflightPatch(p1))).toBe(patchFingerprint(makePreflightPatch(p2)));
  });

  test("analyzePatchRisk flags deletes", () => {
    const risk = analyzePatchRisk(makePreflightPatch({ delete: ["foo.ts"] }));
    expect(risk.deletesCount).toBe(1);
    expect(risk.reasons.join(" ")).toMatch(/deletes/i);
  });

  test("analyzePatchRisk flags high-impact paths", () => {
    const risk = analyzePatchRisk(makePreflightPatch({ upsert: [{ path: ".github/workflows/x.yml", content: "y" }] }));
    expect(risk.riskyPaths).toContain(".github/workflows/x.yml");
    expect(risk.reasons.join(" ")).toMatch(/high-impact/i);
  });

  test("summarizeBatchRisk aggregates risky paths", () => {
    const sum = summarizeBatchRisk([
      { title: "A", patch: makePreflightPatch({ upsert: [{ path: ".github/workflows/a.yml", content: "x" }] }) },
      { title: "B", patch: makePreflightPatch({ delete: ["android/app/build.gradle"] }) },
    ]);
    expect(sum.hasRisk).toBe(true);
    expect(sum.riskyPaths.some((p) => p.includes(".github/workflows/"))).toBe(true);
    expect(sum.riskyPaths).toContain("android/app/build.gradle");
  });




  test("checkPatchLimits soft-warns for large patches", () => {
    const big = {
      upsert: [{ path: "src/big.txt", content: "x".repeat(DEFAULT_PATCH_LIMITS.softMaxChars + 10) }],
    };
    const chk = checkPatchLimits(makePreflightPatch(big), DEFAULT_PATCH_LIMITS);
    expect(chk.softWarn).toBe(true);
    expect(chk.hardFail).toBe(false);
    expect(chk.reasons.join(" ")).toMatch(/large patch/i);
  });

  test("checkPatchLimits hard-fails for huge patches", () => {
    const huge = {
      upsert: [{ path: "src/huge.txt", content: "x".repeat(DEFAULT_PATCH_LIMITS.hardMaxChars + 10) }],
    };
    const chk = checkPatchLimits(makePreflightPatch(huge), DEFAULT_PATCH_LIMITS);
    expect(chk.hardFail).toBe(true);
    expect(chk.reasons.join(" ")).toMatch(/patch size/i);
  });

  test("summarizeBatchLimits aggregates hard and soft", () => {
    const soft = {
      upsert: [{ path: "src/soft.txt", content: "x".repeat(DEFAULT_PATCH_LIMITS.softMaxChars + 10) }],
    };
    const hard = {
      upsert: [{ path: "src/hard.txt", content: "x".repeat(DEFAULT_PATCH_LIMITS.hardMaxChars + 10) }],
    };
    const sum = summarizeBatchLimits(
      [
        { title: "soft", patch: makePreflightPatch(soft) },
        { title: "hard", patch: makePreflightPatch(hard) },
      ],
      DEFAULT_PATCH_LIMITS,
    );
    expect(sum.hasSoft).toBe(true);
    expect(sum.hasHard).toBe(true);
    expect(sum.hard.length).toBe(1);
  });
});
