import { analyzePatchRisk, patchFingerprint, summarizeBatchRisk } from "../diagnostics/fixSafety";

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
});
