import { ensureCiLiteWorkflowBootstrap } from "../lib/ciLiteWorkflowBootstrap";
import { WORKFLOW_TEMPLATES } from "../shared/workflows/managedWorkflowTemplates";

jest.mock("../infra/github/files", () => ({
  getRepoFileText: jest.fn(),
  createOrUpdateFile: jest.fn(),
}));

import { getRepoFileText, createOrUpdateFile } from "../infra/github/files";

const mockGet = getRepoFileText as jest.Mock;
const mockWrite = createOrUpdateFile as jest.Mock;

describe("ensureCiLiteWorkflowBootstrap", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("bootstraps missing workflow", async () => {
    mockGet.mockRejectedValueOnce(new Error("404 not found"));
    const result = await ensureCiLiteWorkflowBootstrap({ owner: "o", repo: "r", branch: "main", workflowFile: "k1w1-ci-lite.yml" });
    expect(result.status).toBe("created");
    expect(mockWrite).toHaveBeenCalled();
  });

  it("repairs stale managed workflow", async () => {
    mockGet.mockResolvedValueOnce("# managed-by: k1w1\n# workflow-version: 100\nname: old");
    const result = await ensureCiLiteWorkflowBootstrap({ owner: "o", repo: "r", branch: "main", workflowFile: "k1w1-ci-lite.yml" });
    expect(result.status).toBe("repaired");
    expect(mockWrite).toHaveBeenCalled();
  });

  it("fails on unmanaged custom workflow", async () => {
    mockGet.mockResolvedValueOnce("name: custom\non:\n  workflow_dispatch:\n");
    await expect(ensureCiLiteWorkflowBootstrap({ owner: "o", repo: "r", branch: "main", workflowFile: "k1w1-ci-lite.yml" })).rejects.toThrow(/nicht als managed/i);
  });

  it("keeps current managed workflow unchanged", async () => {
    mockGet.mockResolvedValueOnce(WORKFLOW_TEMPLATES["k1w1-ci-lite.yml"]);
    const result = await ensureCiLiteWorkflowBootstrap({ owner: "o", repo: "r", branch: "main", workflowFile: "k1w1-ci-lite.yml" });
    expect(result.status).toBe("current");
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it("skips tokenless local bootstrap errors", async () => {
    mockGet.mockRejectedValueOnce(new Error("GitHub token fehlt."));
    const result = await ensureCiLiteWorkflowBootstrap({ owner: "o", repo: "r", branch: "main", workflowFile: "k1w1-ci-lite.yml" });
    expect(result.status).toBe("skipped_tokenless");
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it("supports autofix workflow bootstrap", async () => {
    mockGet.mockRejectedValueOnce(new Error("404 not found"));
    const result = await ensureCiLiteWorkflowBootstrap({ owner: "o", repo: "r", branch: "main", workflowFile: "k1w1-ci-lite-autofix.yml" });
    expect(result.workflowFile).toBe("k1w1-ci-lite-autofix.yml");
    expect(mockWrite.mock.calls[0][2]).toBe(".github/workflows/k1w1-ci-lite-autofix.yml");
  });
});
