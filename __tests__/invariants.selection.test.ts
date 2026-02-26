import fs from "fs";
import path from "path";

/**
 * "YES-tests" (Invariants)
 *
 * These tests are meant to stop regressions where someone accidentally hardcodes
 * repo/branch/workflow defaults instead of using the in-app selections.
 *
 * They are intentionally simple string checks (fast + stable).
 */

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("Invariants: repo/branch selection is source of truth", () => {
  it("Build Screen must NOT silently fall back to 'main' when branch is missing", () => {
    const src = read("screens/EnhancedBuildScreen/hooks/useEnhancedBuildScreen.ts");

    // The Build screen should block with a clear message if branch is missing.
    // It should not quietly assume a branch.
    expect(src).not.toMatch(/\|\|\s*["']main["']/);
  });
});
