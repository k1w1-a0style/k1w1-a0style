import type { ProjectData } from "../shared/types/project";
import { makePreflightPatch } from "./helpers/preflightTestHelpers";
import {
  applyPatchLocally,
  undoHistoryEntries,
} from "../screens/DiagnosticScreen/hooks/fixRunnerLocalMutationExecutor";

function makeProjectRef(files: Array<{ path: string; content: string }>) {
  return {
    current: {
      id: "p1",
      name: "demo",
      files,
    } as ProjectData,
  };
}

describe("fixRunnerLocalMutationExecutor", () => {
  test("applyPatchLocally blocks empty patches", async () => {
    const projectRef = makeProjectRef([{ path: "app.json", content: "{}" }]);

    await expect(
      applyPatchLocally({
        label: "empty",
        patch: makePreflightPatch(),
        projectRef,
        replaceProjectFiles: jest.fn(async () => undefined),
      }),
    ).rejects.toMatchObject({ status: "blocked" });
  });

  test("undoHistoryEntries returns undone count and fail message", async () => {
    const replaceProjectFiles = jest.fn(async () => {
      throw new Error("kaputt");
    });

    const result = await undoHistoryEntries({
      entries: [
        {
          label: "x",
          at: Date.now(),
          snapshot: [{ path: "app.json", content: "{}" }],
          createdPaths: [],
        },
      ],
      currentFiles: [{ path: "app.json", content: "new" }],
      replaceProjectFiles,
    });

    expect(result.undone).toBe(0);
    expect(result.failedMessage).toBe("kaputt");
  });

  test("applyPatchLocally applies delete + upsert in one atomic commit", async () => {
    const projectRef = makeProjectRef([
      { path: "app.json", content: '{"expo":{"name":"old"}}' },
    ]);
    const replaceProjectFiles = jest.fn(async () => undefined);
    await applyPatchLocally({
        label: "atomic",
        patch: makePreflightPatch({
          delete: ["app.json"],
          upsert: [{ path: "app.json", content: '{"expo":{"name":"new"}}' }],
        }),
        projectRef,
        replaceProjectFiles,
    });

    expect(replaceProjectFiles).toHaveBeenCalledTimes(1);
    expect(replaceProjectFiles).toHaveBeenCalledWith([]);
  });

  test("applyPatchLocally reports failed without partial mutation when atomic commit fails", async () => {
    const projectRef = makeProjectRef([{ path: "app.json", content: "{}" }]);
    await expect(
      applyPatchLocally({
        label: "atomic-fail",
        patch: makePreflightPatch({ delete: ["app.json"] }),
        projectRef,
        replaceProjectFiles: jest.fn(async () => {
          throw new Error("Speichern fehlgeschlagen");
        }),
      }),
    ).rejects.toMatchObject({
      status: "failed",
      localChangeApplied: false,
      partial: false,
    });
  });
});
