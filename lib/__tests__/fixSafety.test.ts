import {
  analyzePatchRisk,
  checkPatchLimits,
  DEFAULT_PATCH_LIMITS,
  patchFingerprint,
  summarizeBatchLimits,
  summarizeBatchRisk,
} from "../diagnostics/fixSafety";

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

    expect(patchFingerprint(p1 as any)).toBe(patchFingerprint(p2 as any));
  });

  test("analyzePatchRisk flags deletes", () => {
    const risk = analyzePatchRisk({ delete: ["foo.ts"] } as any);
    expect(risk.deletesCount).toBe(1);
    expect(risk.reasons.join(" ")).toMatch(/deletes/i);
  });

  test("analyzePatchRisk flags high-impact paths", () => {
    const risk = analyzePatchRisk({ upsert: [{ path: ".github/workflows/x.yml", content: "y" }] } as any);
    expect(risk.riskyPaths).toContain(".github/workflows/x.yml");
    expect(risk.reasons.join(" ")).toMatch(/high-impact/i);
  });

  test("summarizeBatchRisk aggregates risky paths", () => {
    const sum = summarizeBatchRisk([
      { title: "A", patch: { upsert: [{ path: ".github/workflows/a.yml", content: "x" }] } as any },
      { title: "B", patch: { delete: ["android/app/build.gradle"] } as any },
    ]);
    expect(sum.hasRisk).toBe(true);
    expect(sum.riskyPaths.some((p) => p.includes(".github/workflows/"))).toBe(true);
    expect(sum.riskyPaths).toContain("android/app/build.gradle");
  });

  test("checkPatchLimits soft-warns for large patches", () => {
    const big = {
      upsert: [{ path: "src/big.txt", content: "x".repeat(DEFAULT_PATCH_LIMITS.softMaxChars + 10) }],
    };
    const chk = checkPatchLimits(big as any, DEFAULT_PATCH_LIMITS);
    expect(chk.softWarn).toBe(true);
    expect(chk.hardFail).toBe(false);
    expect(chk.reasons.join(" ")).toMatch(/large patch/i);
  });

  test("checkPatchLimits hard-fails for huge patches", () => {
    const huge = {
      upsert: [{ path: "src/huge.txt", content: "x".repeat(DEFAULT_PATCH_LIMITS.hardMaxChars + 10) }],
    };
    const chk = checkPatchLimits(huge as any, DEFAULT_PATCH_LIMITS);
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
        { title: "soft", patch: soft as any },
        { title: "hard", patch: hard as any },
      ],
      DEFAULT_PATCH_LIMITS,
    );
    expect(sum.hasSoft).toBe(true);
    expect(sum.hasHard).toBe(true);
    expect(sum.hard.length).toBe(1);
  });
});
