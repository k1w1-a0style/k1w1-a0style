import { buildArtifactFetchContextKey } from "../components/CiLiteHeaderButton/hooks/useCiLiteWorkflowHelpers";

describe("useCiLiteWorkflowHelpers", () => {
  describe("buildArtifactFetchContextKey", () => {
    it("builds a stable key for completed runs", () => {
      expect(
        buildArtifactFetchContextKey({
          githubRepo: " owner/repo ",
          workflowId: "k1w1-ci-lite.yml",
          workflowRunId: 321,
          workflowStatus: "completed",
        }),
      ).toBe("owner/repo::k1w1-ci-lite.yml::321");
    });

    it("returns null when the run is not fetch-eligible", () => {
      expect(
        buildArtifactFetchContextKey({
          githubRepo: "owner/repo",
          workflowId: "k1w1-ci-lite.yml",
          workflowRunId: 321,
          workflowStatus: "in_progress",
        }),
      ).toBeNull();

      expect(
        buildArtifactFetchContextKey({
          githubRepo: "owner/repo",
          workflowId: "k1w1-ci-lite.yml",
          workflowRunId: null,
          workflowStatus: "completed",
        }),
      ).toBeNull();

      expect(
        buildArtifactFetchContextKey({
          githubRepo: "  ",
          workflowId: "k1w1-ci-lite.yml",
          workflowRunId: 321,
          workflowStatus: "completed",
        }),
      ).toBeNull();
    });
  });
});
