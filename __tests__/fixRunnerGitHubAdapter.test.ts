import { dispatchWorkflowFix, syncPatchToGitHub } from "../screens/DiagnosticScreen/hooks/fixRunnerGitHubAdapter";
import { makePreflightPatch, makeProjectRef } from "./helpers/preflightTestHelpers";

jest.mock("../infra/github/githubService", () => ({
  createOrUpdateFile: jest.fn(async () => undefined),
  deleteRepoFile: jest.fn(async () => undefined),
  triggerWorkflow: jest.fn(async () => undefined),
}));

jest.mock("../lib/repoSyncOrchestration", () => ({
  markRepoSyncSignature: jest.fn(async () => undefined),
}));

const {
  createOrUpdateFile,
  deleteRepoFile,
  triggerWorkflow,
} = jest.requireMock("../infra/github/githubService") as {
  createOrUpdateFile: jest.Mock;
  deleteRepoFile: jest.Mock;
  triggerWorkflow: jest.Mock;
};

const { markRepoSyncSignature } = jest.requireMock("../lib/repoSyncOrchestration") as {
  markRepoSyncSignature: jest.Mock;
};

describe("fixRunnerGitHubAdapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("syncPatchToGitHub syncs upsert and delete files and marks signature", async () => {
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

    expect(createOrUpdateFile).toHaveBeenCalledWith(
      "owner",
      "repo",
      "app.json",
      "{}",
      "Diagnostics: Sync",
      "main",
    );
    expect(deleteRepoFile).toHaveBeenCalledWith(
      "owner",
      "repo",
      "package.json",
      "Diagnostics: Sync",
      "main",
    );
    expect(markRepoSyncSignature).toHaveBeenCalled();
  });

  test("dispatchWorkflowFix applies bootstrap patch on 404 and retries", async () => {
    triggerWorkflow
      .mockRejectedValueOnce(new Error("404 not found"))
      .mockResolvedValueOnce(undefined);

    const applyPatch = jest.fn(async () => undefined);

    await dispatchWorkflowFix({
      owner: "owner",
      repo: "repo",
      workflowFileName: "wf.yml",
      workflowRef: "main",
      inputs: {},
      fallbackPatch: makePreflightPatch({ upsert: [{ path: "wf.yml", content: "x" }] }),
      applyPatch,
    });

    expect(applyPatch).toHaveBeenCalledWith("Bootstrap wf.yml", expect.any(Object));
    expect(triggerWorkflow).toHaveBeenCalledTimes(2);
  });
});
