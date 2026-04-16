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
        replaceProjectFiles: jest.fn(async () => undefined),
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

  test("applyPatchLocally does not leave partial local mutation when update commit fails", async () => {
    const projectRef = makeProjectRef([
      { path: "App.tsx", content: "old" },
      { path: "app.json", content: "{\"name\":\"demo\"}" },
    ]);
    const deleteFile = jest.fn(async () => undefined);

    await expect(
      applyPatchLocally({
        label: "atomic-fail",
        patch: makePreflightPatch({
          delete: ["App.tsx"],
          upsert: [{ path: "app.json", content: "{\"name\":\"changed\"}" }],
        }),
        projectRef,
        deleteFile,
        replaceProjectFiles: jest.fn(async () => {
          throw new Error("write failed");
        }),
      }),
    ).rejects.toMatchObject({
      status: "failed",
      partial: false,
      localChangeApplied: false,
    });

    expect(deleteFile).not.toHaveBeenCalled();
    expect(projectRef.current?.files.map((f) => f.path).sort()).toEqual([
      "App.tsx",
      "app.json",
    ]);
  });

  test("applyPatchLocally commits delete + upsert atomically via one update call", async () => {
    const projectRef = makeProjectRef([
      { path: "App.tsx", content: "old" },
      { path: "app.json", content: "{\"name\":\"demo\"}" },
    ]);
    const replaceProjectFiles = jest.fn(async (files) => {
      projectRef.current = {
        ...(projectRef.current as ProjectData),
        files,
      };
    });

    const result = await applyPatchLocally({
      label: "atomic-success",
      patch: makePreflightPatch({
        delete: ["App.tsx"],
        upsert: [{ path: "app.json", content: "{\"name\":\"changed\"}" }],
      }),
      projectRef,
      deleteFile: jest.fn(async () => undefined),
      replaceProjectFiles,
    });

    expect(result.status).toBe("patch_applied");
    expect(replaceProjectFiles).toHaveBeenCalledTimes(1);
    expect(projectRef.current?.files.map((f) => f.path).sort()).toEqual(["app.json"]);
    expect(projectRef.current?.files[0]?.content).toBe("{\"name\":\"changed\"}");
  });
});
