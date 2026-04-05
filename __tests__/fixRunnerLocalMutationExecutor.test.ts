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
        deleteFile: jest.fn(async () => undefined),
        updateProjectFiles: jest.fn(async () => undefined),
      }),
    ).rejects.toMatchObject({ status: "blocked" });
  });

  test("undoHistoryEntries returns undone count and fail message", async () => {
    const updateProjectFiles = jest.fn(async () => {
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
      deleteFile: jest.fn(async () => undefined),
      updateProjectFiles,
    });

    expect(result.undone).toBe(0);
    expect(result.failedMessage).toBe("kaputt");
  });
});
