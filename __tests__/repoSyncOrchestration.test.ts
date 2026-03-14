import {
  computeProjectFilesSignature,
  getRepoSyncState,
  markRepoSyncSignature,
} from "../lib/repoSyncOrchestration";

describe("repoSyncOrchestration", () => {
  it("returns in_sync after marking signature for same files", async () => {
    const store = new Map<string, string>();
    const files = [{ path: "app.json", content: "{}" }] as any;

    await markRepoSyncSignature({
      linkedRepo: "owner/repo",
      linkedBranch: "main",
      files,
      storageSetItem: async (k, v) => void store.set(k, v),
    });

    const state = await getRepoSyncState({
      linkedRepo: "owner/repo",
      linkedBranch: "main",
      files,
      storageGetItem: async (k) => store.get(k) ?? null,
    });

    expect(state).toBe("in_sync");
  });

  it("returns out_of_sync when files changed after mark", async () => {
    const store = new Map<string, string>();
    await markRepoSyncSignature({
      linkedRepo: "owner/repo",
      linkedBranch: "main",
      files: [{ path: "a.ts", content: "export const a = 1;" }] as any,
      storageSetItem: async (k, v) => void store.set(k, v),
    });

    const state = await getRepoSyncState({
      linkedRepo: "owner/repo",
      linkedBranch: "main",
      files: [{ path: "a.ts", content: "export const a = 2;" }] as any,
      storageGetItem: async (k) => store.get(k) ?? null,
    });

    expect(state).toBe("out_of_sync");
  });

  it("signature is deterministic regardless of file order", () => {
    const a = computeProjectFilesSignature([
      { path: "b.ts", content: "2" },
      { path: "a.ts", content: "1" },
    ] as any);
    const b = computeProjectFilesSignature([
      { path: "a.ts", content: "1" },
      { path: "b.ts", content: "2" },
    ] as any);

    expect(a).toBe(b);
  });
});
