import { dispatchWorkflowFix, syncPatchToGitHub } from "../screens/DiagnosticScreen/hooks/fixRunnerGitHubAdapter";
import { makePreflightPatch, makeProjectRef } from "./helpers/preflightTestHelpers";

jest.mock("../infra/github/githubService", () => ({
  applyRepoFilePatchAtomic: jest.fn(async () => undefined),
  triggerWorkflow: jest.fn(async () => undefined),
}));

jest.mock("../lib/repoSyncOrchestration", () => ({
  markRepoSyncSignature: jest.fn(async () => undefined),
}));

const {
  applyRepoFilePatchAtomic,
  triggerWorkflow,
} = jest.requireMock("../infra/github/githubService") as {
  applyRepoFilePatchAtomic: jest.Mock;
  triggerWorkflow: jest.Mock;
};

const { markRepoSyncSignature } = jest.requireMock("../lib/repoSyncOrchestration") as {
  markRepoSyncSignature: jest.Mock;
};

describe("fixRunnerGitHubAdapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("syncPatchToGitHub syncs a pinned snapshot atomically and marks signature", async () => {
    const projectRef = makeProjectRef({
      id: "p1",
      name: "demo",
      files: [{ path: "app.json", content: "{}" }],
    });

    await syncPatchToGitHub({
      label: "Sync",
      patch: makePreflightPatch({
        upsert: [{ path: "app.json", content: "{}" }],
        delete: ["package.json"],
      }),
      linkedRepo: "owner/repo",
      linkedBranch: "main",
      projectRef,
    });

    expect(applyRepoFilePatchAtomic).toHaveBeenCalledWith(
      "owner",
      "repo",
      {
        upsert: [{ path: "app.json", content: "{}" }],
        delete: ["package.json"],
      },
      { branch: "main", message: "Diagnostics: Sync" },
    );
    expect(markRepoSyncSignature).toHaveBeenCalled();
  });

  test("dispatchWorkflowFix surfaces truthful missing_workflow error on 404", async () => {
    triggerWorkflow
      .mockRejectedValueOnce(new Error("404 not found"));

    const applyPatch = jest.fn(async () => undefined);

    await expect(dispatchWorkflowFix({
      owner: "owner",
      repo: "repo",
      workflowFileName: "wf.yml",
      workflowRef: "main",
      inputs: {},
      fallbackPatch: makePreflightPatch({ upsert: [{ path: "wf.yml", content: "x" }] }),
      applyPatch,
    })).rejects.toThrow(/missing_workflow/i);

    expect(applyPatch).not.toHaveBeenCalled();
    expect(triggerWorkflow).toHaveBeenCalledTimes(1);
  });

  test("syncPatchToGitHub fails honestly when local project drifts during sync", async () => {
    const projectRef = makeProjectRef({
      id: "p1",
      name: "demo",
      files: [{ path: "app.json", content: "{}" }],
    });
    applyRepoFilePatchAtomic.mockImplementationOnce(async () => {
      projectRef.current = {
        ...projectRef.current!,
        files: [{ path: "app.json", content: "{\"changed\":true}" }],
      };
    });

    await expect(syncPatchToGitHub({
      label: "Sync",
      patch: makePreflightPatch({
        upsert: [{ path: "app.json", content: "{}" }],
      }),
      linkedRepo: "owner/repo",
      linkedBranch: "main",
      projectRef,
    })).rejects.toThrow(/während GitHub-Sync geändert/i);

    expect(markRepoSyncSignature).not.toHaveBeenCalled();
  });
});
