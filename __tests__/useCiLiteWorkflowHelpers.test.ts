import {
  buildArtifactFetchContextKey,
  getAutofixChainSkipReason,
  getCiLiteWorkflowErrorMessage,
  mergeWorkflowRunLookupDiagnosis,
  parseCiLiteArtifactJson,
  resolveCiLiteWorkflowErrorFallback,
  resolveCiLiteArtifactRequest,
  resolveCiLiteBusyState,
  resolveCiLiteCompletionErrorText,
  resolveCiLiteLookupTimeoutMs,
  hasCiLiteLookupTimedOut,
  resolveHydratedCiLiteStepInfo,
  resolveCiLiteLookupFailureLabel,
  resolveCiLiteLookupFailureMessage,
  resolveCiLitePendingRunMessage,
  splitRepoFullName,
  resolveCiLiteDisplaySnapshot,
  resolveCiLiteTargetRef,
  resolveCiLiteMissingJwtMessage,
  readCiLiteArtifactPayloadCandidate,
  resolveCiLiteMatchedRun,
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

  describe("resolveCiLiteArtifactRequest", () => {
    it("maps workflow id to artifact name and path", () => {
      expect(resolveCiLiteArtifactRequest("k1w1-ci-lite-autofix.yml")).toEqual({
        artifactName: "ci-lite-autofix-logs",
        filePath: "ci-logs/ci-lite-autofix-result.json",
      });
      expect(resolveCiLiteArtifactRequest("k1w1-ci-lite.yml")).toEqual({
        artifactName: "ci-lite-logs",
        filePath: "ci-logs/ci-lite-result.json",
      });
    });
  });



  describe("display snapshot + target ref derivation", () => {
    it("hides hydrated snapshot while active run context exists", () => {
      const hydrated = { branch: "main" };
      expect(
        resolveCiLiteDisplaySnapshot({
          hasActiveRunContext: true,
          workflowRunPresent: false,
          hydratedSnapshot: hydrated,
        }),
      ).toBeNull();

      expect(
        resolveCiLiteDisplaySnapshot({
          hasActiveRunContext: false,
          workflowRunPresent: true,
          hydratedSnapshot: hydrated,
        }),
      ).toBeNull();

      expect(
        resolveCiLiteDisplaySnapshot({
          hasActiveRunContext: false,
          workflowRunPresent: false,
          hydratedSnapshot: hydrated,
        }),
      ).toEqual(hydrated);
    });

    it("resolves target ref with explicit target first, then hydrated branch, then current branch", () => {
      expect(
        resolveCiLiteTargetRef({
          targetRef: " release ",
          hydratedBranch: "main",
          branch: "develop",
        }),
      ).toBe("release");
      expect(
        resolveCiLiteTargetRef({
          targetRef: "",
          hydratedBranch: " main ",
          branch: "develop",
        }),
      ).toBe("main");
      expect(
        resolveCiLiteTargetRef({
          targetRef: "",
          hydratedBranch: "",
          branch: " develop ",
        }),
      ).toBe("develop");
      expect(
        resolveCiLiteTargetRef({
          targetRef: "",
          hydratedBranch: "",
          branch: "",
        }),
      ).toBeNull();
    });
  });

  describe("resolveCiLitePendingRunMessage", () => {
    it("maps waiting states to consistent log lines", () => {
      expect(
        resolveCiLitePendingRunMessage({
          chainWaiting: true,
          workflowId: "k1w1-ci-lite.yml",
          jobId: "abc-123",
        }),
      ).toContain("Autofix fertig");

      expect(
        resolveCiLitePendingRunMessage({
          chainWaiting: false,
          workflowId: "k1w1-ci-lite.yml",
          jobId: "abc-123",
        }),
      ).toContain("job_id: abc-123");

      expect(
        resolveCiLitePendingRunMessage({
          chainWaiting: false,
          workflowId: "k1w1-ci-lite.yml",
          jobId: null,
        }),
      ).toBe("Warte auf GitHub Run…");
    });
  });

  describe("resolveCiLiteMissingJwtMessage", () => {
    it("keeps context-specific fail-closed JWT guard messages stable", () => {
      expect(resolveCiLiteMissingJwtMessage("artifact")).toContain("CI-Lite-Artefakt blockiert");
      expect(resolveCiLiteMissingJwtMessage("lookup")).toContain("Workflow-Run-Lookup blockiert");
      expect(resolveCiLiteMissingJwtMessage("dispatch")).toContain("Workflow-Dispatch blockiert");
    });
  });

  describe("resolveCiLiteMatchedRun", () => {
    it("returns a normalized run id + url for valid candidates", () => {
      expect(resolveCiLiteMatchedRun({ id: "321", html_url: "https://example.com/runs/321" })).toEqual({
        runId: 321,
        runUrl: "https://example.com/runs/321",
      });
      expect(resolveCiLiteMatchedRun({ id: 99, html_url: "   " })).toEqual({
        runId: 99,
        runUrl: null,
      });
    });

    it("rejects candidates without a numeric run id", () => {
      expect(resolveCiLiteMatchedRun(null)).toBeNull();
      expect(resolveCiLiteMatchedRun({ id: null })).toBeNull();
      expect(resolveCiLiteMatchedRun({ id: "abc" })).toBeNull();
      expect(resolveCiLiteMatchedRun({ id: 0 })).toBeNull();
      expect(resolveCiLiteMatchedRun({ id: -10 })).toBeNull();
      expect(resolveCiLiteMatchedRun({ id: 3.14 })).toBeNull();
    });
  });

  describe("resolveHydratedCiLiteStepInfo", () => {
    it("maps hydrated booleans to deterministic step info", () => {
      expect(resolveHydratedCiLiteStepInfo({ lintOk: true, typecheckOk: false })).toEqual({
        lint: "success",
        typecheck: "failure",
        eslintErrors: 0,
        tsErrors: 1,
      });
      expect(resolveHydratedCiLiteStepInfo({ lintOk: false, typecheckOk: true })).toEqual({
        lint: "failure",
        typecheck: "success",
        eslintErrors: 1,
        tsErrors: 0,
      });
    });
  });

  describe("resolveCiLiteLookupFailureLabel", () => {
    it("maps chain/default contexts to stable workflow labels", () => {
      expect(resolveCiLiteLookupFailureLabel("chain")).toBe("Autofix-Chain → CI Lite");
      expect(resolveCiLiteLookupFailureLabel("default")).toBe("Workflow");
    });
  });

  describe("lookup timeout helpers", () => {
    it("maps lookup mode to deterministic timeout windows", () => {
      expect(resolveCiLiteLookupTimeoutMs("chain")).toBe(75_000);
      expect(resolveCiLiteLookupTimeoutMs("default")).toBe(60_000);
    });

    it("detects lookup timeout against the mode-specific timeout", () => {
      expect(hasCiLiteLookupTimedOut({ startedAtMs: 1_000, mode: "default", nowMs: 61_001 })).toBe(true);
      expect(hasCiLiteLookupTimedOut({ startedAtMs: 1_000, mode: "default", nowMs: 60_000 })).toBe(false);
      expect(hasCiLiteLookupTimedOut({ startedAtMs: 1_000, mode: "chain", nowMs: 76_100 })).toBe(true);
      expect(hasCiLiteLookupTimedOut({ startedAtMs: 1_000, mode: "chain", nowMs: 75_000 })).toBe(false);
    });
  });

  describe("resolveCiLiteCompletionErrorText", () => {
    it("prioritizes completed workflow failure over hydrated fallback", () => {
      expect(
        resolveCiLiteCompletionErrorText({
          workflowStatus: "completed",
          workflowConclusion: "failure",
          hydratedConclusion: "cancelled",
        }),
      ).toContain("Workflow failed (failure)");

      expect(
        resolveCiLiteCompletionErrorText({
          workflowStatus: "in_progress",
          workflowConclusion: null,
          hydratedConclusion: "cancelled",
        }),
      ).toContain("nicht grün");

      expect(
        resolveCiLiteCompletionErrorText({
          workflowStatus: "completed",
          workflowConclusion: "success",
          hydratedConclusion: "success",
        }),
      ).toBe("");
    });
  });

  describe("resolveCiLiteBusyState", () => {
    it("treats active dispatch/lookup/log loading and queued statuses as busy", () => {
      expect(
        resolveCiLiteBusyState({
          dispatching: false,
          locatingRun: false,
          chainWaiting: false,
          logsLoading: false,
          workflowStatus: "queued",
        }),
      ).toBe(true);
      expect(
        resolveCiLiteBusyState({
          dispatching: true,
          locatingRun: false,
          chainWaiting: false,
          logsLoading: false,
          workflowStatus: "completed",
        }),
      ).toBe(true);
      expect(
        resolveCiLiteBusyState({
          dispatching: false,
          locatingRun: false,
          chainWaiting: false,
          logsLoading: false,
          workflowStatus: "completed",
        }),
      ).toBe(false);
    });
  });

  describe("getAutofixChainSkipReason", () => {
    it("maps known chain-run skip diagnostics", () => {
      expect(getAutofixChainSkipReason(["No TARGET_BRANCH set, skipping CI Lite chain-run"])).toBe(
        "Kein TARGET_BRANCH im Autofix-Run",
      );
      expect(getAutofixChainSkipReason(["Ref looks like a SHA, skipping CI Lite chain-run"])).toBe(
        "Ref wurde als SHA statt Branch erkannt",
      );
      expect(getAutofixChainSkipReason(["Unsafe ref, skipping CI Lite chain-run"])).toBe(
        "Ref enthält unsichere Zeichen",
      );
      expect(
        getAutofixChainSkipReason(["CI Lite chain-run disabled for branch regex: release/.*"]),
      ).toBe("Ref ist laut Workflow-Regeln nicht für Chain-Run erlaubt");
      expect(
        getAutofixChainSkipReason([
          "origin/ref is not a remote branch, skipping CI Lite chain-run",
        ]),
      ).toBe("Ref existiert nicht als Remote-Branch");
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

  describe("readCiLiteArtifactPayloadCandidate", () => {
    it("throws a stable validation error when text JSON is malformed", () => {
      expect(() =>
        readCiLiteArtifactPayloadCandidate({
          text: "{not-valid-json}",
        }),
      ).toThrow("Artifact JSON missing or invalid");
    });
  });

  describe("resolveCiLiteWorkflowErrorFallback", () => {
    it("uses a trimmed Error message when available", () => {
      expect(resolveCiLiteWorkflowErrorFallback(new Error("lookup failed"))).toBe("lookup failed");
    });

    it("falls back to default or provided fallback for unknown inputs", () => {
      expect(resolveCiLiteWorkflowErrorFallback({})).toBe(
        "Workflow-Lookup fehlgeschlagen. Bitte erneut versuchen.",
      );
      expect(resolveCiLiteWorkflowErrorFallback(null, "custom fallback")).toBe("custom fallback");
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

  describe("readCiLiteArtifactPayloadCandidate", () => {
    it("prefers inline json and falls back to parsing text payload", () => {
      expect(
        readCiLiteArtifactPayloadCandidate({
          json: { ok: true, eslint_exit: 0 },
          text: "{\"ok\":false}",
        }),
      ).toEqual({ ok: true, eslint_exit: 0 });

      expect(
        readCiLiteArtifactPayloadCandidate({
          text: "{\"ok\":false,\"tsc_exit\":1}",
        }),
      ).toEqual({ ok: false, tsc_exit: 1 });
    });

    it("returns null for unsupported payload shapes", () => {
      expect(readCiLiteArtifactPayloadCandidate(null)).toBeNull();
      expect(readCiLiteArtifactPayloadCandidate({ text: 42 })).toBeNull();
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

  describe("resolveCiLiteLookupFailureMessage", () => {
    it("maps ambiguous and contract-mismatch diagnosis before timeout fallback", () => {
      expect(
        resolveCiLiteLookupFailureMessage({
          diagnosis: {
            exactJobIdMatchFound: false,
            fallbackCandidateCount: 0,
            ambiguous: true,
            contractMismatchLikely: false,
            plausibleCandidateCount: 0,
            selectedTier: null,
          },
          workflowLabel: "Workflow",
        }),
      ).toContain("mehrere frische Kandidaten");

      expect(
        resolveCiLiteLookupFailureMessage({
          diagnosis: {
            exactJobIdMatchFound: false,
            fallbackCandidateCount: 1,
            ambiguous: false,
            contractMismatchLikely: true,
            plausibleCandidateCount: 0,
            selectedTier: null,
          },
          workflowLabel: "Workflow",
        }),
      ).toContain("job_id");

      expect(
        resolveCiLiteLookupFailureMessage({
          diagnosis: null,
          workflowLabel: "Workflow",
        }),
      ).toContain("Timeout");
    });
  });
});
