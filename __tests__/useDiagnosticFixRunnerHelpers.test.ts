import {
  collectPatchTouchedPaths,
  normalizeFilesForCompare,
  sameProjectFiles,
  shouldSyncPatchToGitHub,
} from "../screens/DiagnosticScreen/hooks/useDiagnosticFixRunnerHelpers";

describe("useDiagnosticFixRunnerHelpers", () => {
  it("normalizes file arrays deterministically for comparisons", () => {
    const files = [
      { path: "b.ts", content: "2" },
      { path: "a.ts", content: "1" },
    ];

    expect(normalizeFilesForCompare(files)).toEqual([
      { path: "a.ts", content: "1" },
      { path: "b.ts", content: "2" },
    ]);
  });

  it("compares project files order-independently", () => {
    const left = [
      { path: "a.ts", content: "1" },
      { path: "b.ts", content: "2" },
    ];
    const right = [
      { path: "b.ts", content: "2" },
      { path: "a.ts", content: "1" },
    ];

    expect(sameProjectFiles(left, right)).toBe(true);
    expect(sameProjectFiles(left, [{ path: "a.ts", content: "changed" }])).toBe(false);
  });

  it("collects touched paths with normalization and dedupe", () => {
    const touched = collectPatchTouchedPaths({
      upsert: [{ path: "src//app.ts", content: "x" }],
      delete: ["src/app.ts"],
      jsonMerge: [{ path: "package.json", patch: {} }],
    });

    expect(touched).toEqual(["package.json", "src/app.ts"]);
  });

  it("detects sync-relevant patches only for linked repos with enabled sync", () => {
    const workflowPatch = {
      upsert: [{ path: ".github/workflows/ci.yml", content: "name: ci" }],
    };

    expect(
      shouldSyncPatchToGitHub({
        patch: workflowPatch,
        linkedRepo: "owner/repo",
        syncFixesToGitHub: true,
      }),
    ).toBe(true);

    expect(
      shouldSyncPatchToGitHub({
        patch: workflowPatch,
        linkedRepo: "bad-format",
        syncFixesToGitHub: true,
      }),
    ).toBe(false);

    expect(
      shouldSyncPatchToGitHub({
        patch: workflowPatch,
        linkedRepo: "owner/repo",
        syncFixesToGitHub: false,
      }),
    ).toBe(false);
  });
});
