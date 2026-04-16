import {
  applyUndoHistoryEntry,
  buildPatchApplyState,
  collectNormalizedTouchedPaths,
  countPatchOperations,
} from "../screens/DiagnosticScreen/hooks/fixRunnerMutationHelpers";
import { makePreflightPatch } from "./helpers/preflightTestHelpers";
import type { FixHistoryEntry } from "../screens/DiagnosticScreen/types";

describe("fixRunnerMutationHelpers", () => {
  test("countPatchOperations sums upsert/delete/jsonMerge lengths", () => {
    const patch = makePreflightPatch({
      upsert: [{ path: "a.txt", content: "1" }],
      delete: ["b.txt"],
      jsonMerge: [{ path: "c.json", patch: {}, createIfMissing: true }],
    });
    expect(countPatchOperations(patch)).toBe(3);
  });

  test("collectNormalizedTouchedPaths returns sorted unique normalized paths", () => {
    const patch = makePreflightPatch({
      upsert: [{ path: "src/z.ts", content: "export {};" }],
      delete: ["src/a.ts", "src/a.ts"],
    });
    expect(collectNormalizedTouchedPaths(patch)).toEqual(["src/a.ts", "src/z.ts"]);
  });

  test("buildPatchApplyState produces next files and delete paths", async () => {
    const patch = makePreflightPatch({
      upsert: [{ path: "src/b.ts", content: "export const b = 1;" }],
      delete: ["src/a.ts"],
    });
    const state = await buildPatchApplyState({
      patch,
      currentFiles: [
        { path: "src/a.ts", content: "old" },
        { path: "src/b.ts", content: "old-b" },
      ],
      applyJsonMerge: async (files) => files,
    });
    expect(state.deletePaths).toEqual(["src/a.ts"]);
    expect(state.createdPaths).toEqual([]);
    expect(state.snapshot.map((f) => f.path).sort()).toEqual(["src/a.ts", "src/b.ts"]);
    expect(state.nextFiles.find((f) => f.path === "src/b.ts")?.content).toBe("export const b = 1;");
    expect(state.nextFiles.find((f) => f.path === "src/a.ts")).toBeUndefined();
  });

  test("applyUndoHistoryEntry replays created deletions and snapshot restore", async () => {
    const replaceProjectFiles = jest.fn(async () => undefined);
    const entry: FixHistoryEntry = {
      label: "x",
      at: 1,
      createdPaths: ["new.txt"],
      snapshot: [{ path: "a.txt", content: "old" }],
    };
    const nextFiles = await applyUndoHistoryEntry({
      entry,
      currentFiles: [
        { path: "a.txt", content: "new" },
        { path: "new.txt", content: "created" },
      ],
      replaceProjectFiles,
    });
    expect(nextFiles).toEqual([{ path: "a.txt", content: "old" }]);
    expect(replaceProjectFiles).toHaveBeenCalledWith(nextFiles);
  });
});
