import {
  compactUnifiedDiff,
  diffLineStyle,
  safeSliceLines,
  statusGlyph,
  unifiedLineDiff,
} from "../screens/GitHubReposScreen/components/LocalRemoteDiffSection/diffAlgorithms";

describe("localRemoteDiffSection diff algorithms", () => {
  it("keeps glyph mapping stable", () => {
    expect(statusGlyph("localOnly")).toBe("+");
    expect(statusGlyph("remoteOnly")).toBe("-");
    expect(statusGlyph("modified")).toBe("±");
    expect(statusGlyph("same")).toBe("=");
    expect(statusGlyph("skipped")).toBe("·");
    expect(statusGlyph("error")).toBe("!");
  });

  it("builds deterministic unified line diffs", () => {
    const out = unifiedLineDiff("a\nb\nc", "a\nx\nc");
    expect(out).toContain("  a");
    expect(out).toContain("- b");
    expect(out).toContain("+ x");
    expect(out).toContain("  c");
  });

  it("returns large-diff guard message for huge matrix", () => {
    const huge = new Array(450).fill("x").join("\n");
    expect(unifiedLineDiff(huge, huge)).toContain("Diff Preview ist zu groß");
  });

  it("compacts oversized diff output around changed lines", () => {
    const lines = [
      ...new Array(180).fill("  same"),
      "- old",
      "+ new",
      ...new Array(180).fill("  same"),
    ].join("\n");
    const compact = compactUnifiedDiff(lines, 2, 30);
    expect(compact).toContain("- old");
    expect(compact).toContain("+ new");
    expect(compact).toContain("…");
  });

  it("safe slices and styles lines", () => {
    expect(safeSliceLines("1\n2\n3", 2)).toEqual({ text: "1\n2", truncated: true, total: 3 });
    expect(diffLineStyle("+ add")).toHaveProperty("color");
  });
});
