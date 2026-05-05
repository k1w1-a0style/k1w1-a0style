import { ensureCiLiteWorkflowBootstrap } from "../lib/ciLiteWorkflowBootstrap";
import { WORKFLOW_TEMPLATES } from "../shared/workflows/managedWorkflowTemplates";

jest.mock("../infra/github/files", () => ({
  getRepoFileText: jest.fn(),
  createOrUpdateFile: jest.fn(),
}));

jest.mock("../infra/github/branchOps", () => ({
  getBranchHeadSha: jest.fn(),
  getDefaultBranch: jest.fn(),
}));

import { getRepoFileText, createOrUpdateFile } from "../infra/github/files";
import { getBranchHeadSha, getDefaultBranch } from "../infra/github/branchOps";

const mockGet = getRepoFileText as jest.MockedFunction<typeof getRepoFileText>;
const mockWrite = createOrUpdateFile as jest.MockedFunction<typeof createOrUpdateFile>;
const mockHead = getBranchHeadSha as jest.MockedFunction<typeof getBranchHeadSha>;
const mockDefault = getDefaultBranch as jest.MockedFunction<typeof getDefaultBranch>;

describe("ensureCiLiteWorkflowBootstrap", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockHead.mockResolvedValue("abc");
    mockDefault.mockResolvedValue("main");
  });

  it("returns diagnosis fields for current workflow", async () => {
    mockGet.mockResolvedValueOnce(WORKFLOW_TEMPLATES["k1w1-ci-lite.yml"]);
    const result = await ensureCiLiteWorkflowBootstrap({ owner: "o", repo: "r", branch: "main", workflowFile: "k1w1-ci-lite.yml" });
    expect(result.status).toBe("current");
    expect(result.targetRepo).toBe("o/r");
    expect(result.targetBranch).toBe("main");
    expect(result.defaultBranch).toBe("main");
    expect(result.workflowDefinitionBranch).toBe("main");
    expect(result.targetBranchWorkflowStatus).toBe("current");
    expect(result.defaultBranchWorkflowStatus).toBe("current");
    expect(result.hasWorkflowDispatch).toBe(true);
    expect(result.hasRequiredInputs).toBe(true);
    expect(result.githubIndexMayLag).toBe(false);
    expect(result.recommendedWaitSeconds).toBe(0);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it("bootstraps missing workflow and sets lag hints", async () => {
    mockGet.mockRejectedValueOnce(new Error("404 not found"));
    const result = await ensureCiLiteWorkflowBootstrap({ owner: "o", repo: "r", branch: "main", workflowFile: "k1w1-ci-lite.yml" });
    expect(result.status).toBe("created");
    expect(result.githubIndexMayLag).toBe(true);
    expect(result.recommendedWaitSeconds).toBe(60);
    expect(mockWrite).toHaveBeenCalled();
  });

  it("handles defaultBranch != targetBranch and repairs both branches when needed", async () => {
    mockDefault.mockResolvedValueOnce("develop");
    mockGet
      .mockRejectedValueOnce(new Error("404 not found"))
      .mockRejectedValueOnce(new Error("404 not found"));
    const result = await ensureCiLiteWorkflowBootstrap({ owner: "o", repo: "r", branch: "feature/a", workflowFile: "k1w1-ci-lite.yml" });
    expect(result.defaultBranch).toBe("develop");
    expect(result.targetBranch).toBe("feature/a");
    expect(result.defaultBranchWorkflowStatus).toBe("missing");
    expect(result.targetBranchWorkflowStatus).toBe("missing");
    expect(mockWrite).toHaveBeenCalledTimes(2);
  });

  it("fails on unmanaged custom workflow", async () => {
    mockGet.mockResolvedValueOnce("name: custom\non:\n  workflow_dispatch:\n");
    await expect(ensureCiLiteWorkflowBootstrap({ owner: "o", repo: "r", branch: "main", workflowFile: "k1w1-ci-lite.yml" })).rejects.toThrow(/unmanaged/i);
  });

  it.each([
    "GitHub Token ungültig.",
    "Keine Berechtigung.",
    "Keine Berechtigung. Token benötigt Repo-Write Rechte.",
  ])("returns skipped_tokenless on localized branch auth failure: %s", async (message) => {
    mockHead.mockRejectedValueOnce(new Error(message));
    const result = await ensureCiLiteWorkflowBootstrap({ owner: "o", repo: "r", branch: "main", workflowFile: "k1w1-ci-lite.yml" });
    expect(result.status).toBe("skipped_tokenless");
  });

  it("returns skipped_tokenless on default-branch auth failure", async () => {
    mockDefault.mockRejectedValueOnce(new Error("Repo-Info Fehler (403)"));
    const result = await ensureCiLiteWorkflowBootstrap({ owner: "o", repo: "r", branch: "main", workflowFile: "k1w1-ci-lite.yml" });
    expect(result.status).toBe("skipped_tokenless");
  });

  it.each([
    "Branch oder Repo nicht gefunden.",
    "404 not found",
  ])("throws branch-missing only for real missing branch/repo errors: %s", async (message) => {
    mockHead.mockRejectedValueOnce(new Error(message));
    await expect(ensureCiLiteWorkflowBootstrap({ owner: "o", repo: "r", branch: "missing", workflowFile: "k1w1-ci-lite.yml" })).rejects.toThrow(/does not exist/i);
  });

  it.each([
    "Branch-HEAD Fehler (500)",
    "rate limit exceeded",
    "network request failed",
  ])("preserves upstream branch validation failures: %s", async (message) => {
    mockHead.mockRejectedValueOnce(new Error(message));
    try {
      await ensureCiLiteWorkflowBootstrap({ owner: "o", repo: "r", branch: "main", workflowFile: "k1w1-ci-lite.yml" });
      throw new Error("expected ensureCiLiteWorkflowBootstrap to reject");
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : String(error);
      expect(text).toContain("CI-Lite target branch validation failed:");
      expect(text).toContain(message);
      expect(text).not.toMatch(/does not exist/i);
    }
  });
});
