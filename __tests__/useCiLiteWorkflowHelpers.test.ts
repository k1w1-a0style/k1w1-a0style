import {
  buildArtifactFetchContextKey,
  getAutofixChainSkipReason,
  getCiLiteWorkflowErrorMessage,
  splitRepoFullName,
} from "../components/CiLiteHeaderButton/hooks/useCiLiteWorkflowHelpers";

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

  describe("getAutofixChainSkipReason", () => {
    it("maps known chain-run skip diagnostics", () => {
      expect(getAutofixChainSkipReason(["No TARGET_BRANCH set, skipping CI Lite chain-run"])).toBe(
        "Kein TARGET_BRANCH im Autofix-Run",
      );
      expect(getAutofixChainSkipReason(["Unsafe ref, skipping CI Lite chain-run"])).toBe(
        "Ref enthält unsichere Zeichen",
      );
      expect(getAutofixChainSkipReason(["some neutral line"])).toBeNull();
    });
  });

  describe("splitRepoFullName", () => {
    it("parses owner/repo and rejects malformed values", () => {
      expect(splitRepoFullName("owner/repo")).toEqual({ owner: "owner", repo: "repo" });
      expect(splitRepoFullName("owner")).toBeNull();
    });
  });

  describe("getCiLiteWorkflowErrorMessage", () => {
    it("extracts error message text from common unknown inputs", () => {
      expect(getCiLiteWorkflowErrorMessage(new Error("broken"))).toBe("broken");
      expect(getCiLiteWorkflowErrorMessage({ message: "from-object" })).toBe("from-object");
      expect(getCiLiteWorkflowErrorMessage(42, "fallback")).toBe("fallback");
    });
  });
});
