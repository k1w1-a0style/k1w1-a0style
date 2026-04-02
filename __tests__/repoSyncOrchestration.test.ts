import {
  computeProjectFilesSignature,
  getRepoSyncState,
  markRepoSyncSignature,
} from "../lib/repoSyncOrchestration";
import { makeProjectFile } from "./helpers/projectTestHelpers";

describe("repoSyncOrchestration", () => {
  it("returns in_sync after marking signature for same files", async () => {
    const store = new Map<string, string>();
    const files = [makeProjectFile("app.json", "{}")];

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
      files: [makeProjectFile("a.ts", "export const a = 1;")],
      storageSetItem: async (k, v) => void store.set(k, v),
    });

    const state = await getRepoSyncState({
      linkedRepo: "owner/repo",
      linkedBranch: "main",
      files: [makeProjectFile("a.ts", "export const a = 2;")],
      storageGetItem: async (k) => store.get(k) ?? null,
    });

    expect(state).toBe("out_of_sync");
  });

  it("signature is deterministic regardless of file order", () => {
    const a = computeProjectFilesSignature([
      makeProjectFile("b.ts", "2"),
      makeProjectFile("a.ts", "1"),
    ]);
    const b = computeProjectFilesSignature([
      makeProjectFile("a.ts", "1"),
      makeProjectFile("b.ts", "2"),
    ]);

    expect(a).toBe(b);
  });
});
