import {
  buildArtifactFetchContextKey,
  getAutofixChainSkipReason,
  getCiLiteWorkflowErrorMessage,
  mergeWorkflowRunLookupDiagnosis,
  parseCiLiteArtifactJson,
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

  describe("parseCiLiteArtifactJson", () => {
    it("normalizes artifact payload values", () => {
      expect(
        parseCiLiteArtifactJson({
          ok: 1,
          eslint_exit: 0,
          tsc_exit: 1,
          source_commit_sha: " abc ",
          source_sha: "",
        }),
      ).toEqual({
        ok: true,
        eslint_exit: 0,
        tsc_exit: 1,
        source_commit_sha: "abc",
        source_sha: undefined,
        github_sha: undefined,
      });
    });

    it("throws for non-object payloads", () => {
      expect(() => parseCiLiteArtifactJson(null)).toThrow("Artifact JSON missing or invalid");
    });
  });

  describe("mergeWorkflowRunLookupDiagnosis", () => {
    it("keeps previous diagnosis when next is null", () => {
      const previous = {
        exactJobIdMatchFound: false,
        fallbackCandidateCount: 1,
        ambiguous: true,
        contractMismatchLikely: false,
        plausibleCandidateCount: 2,
        selectedTier: null,
      };
      expect(mergeWorkflowRunLookupDiagnosis(previous, null)).toEqual(previous);
    });

    it("returns next when explicit match tier exists", () => {
      const previous = {
        exactJobIdMatchFound: false,
        fallbackCandidateCount: 1,
        ambiguous: true,
        contractMismatchLikely: true,
        plausibleCandidateCount: 2,
        selectedTier: null,
      };
      const next = {
        exactJobIdMatchFound: true,
        fallbackCandidateCount: 0,
        ambiguous: false,
        contractMismatchLikely: false,
        plausibleCandidateCount: 1,
        selectedTier: "exact_job_id" as const,
      };
      expect(mergeWorkflowRunLookupDiagnosis(previous, next)).toEqual(next);
    });

    it("carries forward mismatch signals when next is neutral", () => {
      const previous = {
        exactJobIdMatchFound: false,
        fallbackCandidateCount: 3,
        ambiguous: true,
        contractMismatchLikely: false,
        plausibleCandidateCount: 2,
        selectedTier: null,
      };
      const next = {
        exactJobIdMatchFound: false,
        fallbackCandidateCount: 1,
        ambiguous: false,
        contractMismatchLikely: false,
        plausibleCandidateCount: 1,
        selectedTier: null,
      };
      expect(mergeWorkflowRunLookupDiagnosis(previous, next)).toEqual({
        ...next,
        ambiguous: true,
        contractMismatchLikely: false,
        fallbackCandidateCount: 3,
        plausibleCandidateCount: 2,
      });
    });
  });
});
