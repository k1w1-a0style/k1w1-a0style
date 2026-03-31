import {
  buildFixPreviewEntries,
  collectDeletedPatchPaths,
  collectPatchTouchedPaths,
  isSyncRelevantPath,
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

  it("collects deleted paths with normalization and dedupe", () => {
    const deleted = collectDeletedPatchPaths({
      delete: ["src//app.ts", "src/app.ts", "../invalid"],
    });
    expect(deleted).toEqual(["src/app.ts"]);
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

  it("maps sync-relevant file paths explicitly", () => {
    expect(isSyncRelevantPath(".github/workflows/ci.yml")).toBe(true);
    expect(isSyncRelevantPath("app.config.ts")).toBe(true);
    expect(isSyncRelevantPath("src/App.tsx")).toBe(false);
  });

  it("builds preview entries for upsert/delete/jsonMerge in stable order", () => {
    const entries = buildFixPreviewEntries(
      [
        { path: "a.ts", content: "old-a" },
        { path: "b.json", content: "{\"a\":1}" },
      ],
      {
        upsert: [{ path: "a.ts", content: "new-a" }],
        delete: ["missing.ts"],
        jsonMerge: [{ path: "b.json", patch: { a: 2 } }],
      },
    );

    expect(entries).toEqual([
      { path: "a.ts", oldText: "old-a", newText: "new-a" },
      { path: "missing.ts", oldText: null, newText: null },
      {
        path: "b.json",
        oldText: "{\"a\":1}",
        newText: "• JSON merge patch (Preview zeigt nur vorher – nachher wird beim Apply erzeugt)",
      },
    ]);
  });
});
