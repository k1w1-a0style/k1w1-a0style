import type { ProjectFile } from "../shared/types/project";
import {
  executePullApply,
  resolvePullApplySemantics,
} from "../screens/GitHubReposScreen/utils/pullApplySemantics";
import { resolvePushPreparation } from "../screens/GitHubReposScreen/utils/pushSelectionSemantics";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("GitHubReposScreen pull/push semantics helpers", () => {
  const localFiles: ProjectFile[] = [{ path: "App.tsx", content: "local" }];

  test("awaits the local project write before sync signature and refresh", async () => {
    const deferred = createDeferred<void>();
    const order: string[] = [];

    const applyPromise = executePullApply({
      localFiles,
      remoteFiles: [{ path: "App.tsx", content: "remote" }],
      strategy: "overwrite",
      updateProjectFiles: async () => {
        order.push("write:start");
        await deferred.promise;
        order.push("write:done");
      },
      markSyncSignature: async () => {
        order.push("mark");
      },
      refreshSyncStatus: async () => {
        order.push("refresh");
      },
    });

    await Promise.resolve();
    expect(order).toEqual(["write:start"]);

    deferred.resolve(undefined);
    const result = await applyPromise;

    expect(order).toEqual(["write:start", "write:done", "mark", "refresh"]);
    expect(result.outcome).toBe("applied");
    expect(result.messageTitle).toBe("✅ Pull angewendet");
  });

  test("does not mark sync or refresh when the local apply fails", async () => {
    const order: string[] = [];

    await expect(
      executePullApply({
        localFiles,
        remoteFiles: [{ path: "App.tsx", content: "remote" }],
        strategy: "overwrite",
        updateProjectFiles: async () => {
          order.push("write");
          throw new Error("disk full");
        },
        markSyncSignature: async () => {
          order.push("mark");
        },
        refreshSyncStatus: async () => {
          order.push("refresh");
        },
      }),
    ).rejects.toThrow("disk full");

    expect(order).toEqual(["write"]);
  });

  test("classifies unchanged pull results as no-op instead of a normal success", async () => {
    const result = await executePullApply({
      localFiles,
      remoteFiles: [{ path: "App.tsx", content: "local" }],
      strategy: "overwrite",
      updateProjectFiles: jest.fn(async () => undefined),
      markSyncSignature: jest.fn(async () => undefined),
      refreshSyncStatus: jest.fn(async () => undefined),
    });

    expect(result.outcome).toBe("noop");
    expect(result.localWriteRequired).toBe(false);
    expect(result.shouldMarkSyncSignature).toBe(true);
    expect(result.messageTitle).toBe("ℹ️ Pull ohne Änderungen");
  });

  test("skipConflicts stays partial and never false-green", () => {
    const result = resolvePullApplySemantics({
      localFiles,
      remoteFiles: [
        { path: "App.tsx", content: "remote-conflict" },
        { path: "README.md", content: "new-file" },
      ],
      strategy: "skipConflicts",
    });

    expect(result.outcome).toBe("partial");
    expect(result.localWriteRequired).toBe(true);
    expect(result.shouldMarkSyncSignature).toBe(false);
    expect(result.mergedFiles).toEqual([
      { path: "App.tsx", content: "local" },
      { path: "README.md", content: "new-file" },
    ]);
    expect(result.messageTitle).toBe("⚠️ Pull teilweise angewendet");
  });

  test("push guards reject empty selection and missing branch without false success", () => {
    expect(
      resolvePushPreparation({
        activeBranch: "main",
        pushSelectedPaths: {},
        localFiles,
      }),
    ).toEqual({
      ok: false,
      title: "⚠️",
      message: "Keine Dateien ausgewählt.",
    });

    expect(
      resolvePushPreparation({
        activeBranch: null,
        pushSelectedPaths: { "App.tsx": true },
        localFiles,
      }),
    ).toEqual({
      ok: false,
      title: "⚠️ Push",
      message: "Kein Branch ausgewählt.",
    });
  });

  test("successful pull apply remains cleanly successful and consistent", async () => {
    const order: string[] = [];

    const result = await executePullApply({
      localFiles,
      remoteFiles: [{ path: "App.tsx", content: "remote" }],
      strategy: "overwrite",
      updateProjectFiles: async (files) => {
        order.push(`write:${files[0]?.content}`);
      },
      markSyncSignature: async () => {
        order.push("mark");
      },
      refreshSyncStatus: async () => {
        order.push("refresh");
      },
    });

    expect(order).toEqual(["write:remote", "mark", "refresh"]);
    expect(result.outcome).toBe("applied");
    expect(result.shouldMarkSyncSignature).toBe(true);
    expect(result.messageTitle).toBe("✅ Pull angewendet");
  });
});
