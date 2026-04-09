import {
  resolveCiLiteArtifactRequest,
  buildArtifactFetchContextKey,
  readCiLiteArtifactPayloadCandidate,
  type ArtifactFetchContextInput,
  type CiLiteArtifactJson,
} from "./useCiLiteWorkflowArtifactHelpers";
import {
  resolveCiLitePendingRunMessage,
  resolveHydratedCiLiteStepInfo,
  resolveCiLiteCompletionErrorText,
  getAutofixChainSkipReason,
  resolveCiLiteDisplaySnapshot,
  resolveCiLiteTargetRef,
  type CiLiteStepInfo,
} from "./useCiLiteWorkflowStateHelpers";
import {
  resolveCiLiteLookupFailureLabel,
  resolveCiLiteLookupTimeoutMs,
  hasCiLiteLookupTimedOut,
  getCiLiteWorkflowErrorMessage,
  resolveCiLiteWorkflowErrorFallback,
  mergeWorkflowRunLookupDiagnosis,
  resolveCiLiteLookupFailureMessage,
} from "./useCiLiteWorkflowLookupHelpers";

export {
  splitRepoFullName,
  resolveCiLiteDispatchSelection,
  resolveCiLiteSyncStateError,
  resolveCiLiteMissingJwtMessage,
  resolveCiLiteMatchedRun,
  type CiLiteDispatchSelectionResult,
  type CiLiteLookupCandidate,
} from "./useCiLiteWorkflowContracts";

export {
  resolveCiLiteArtifactRequest,
  buildArtifactFetchContextKey,
  readCiLiteArtifactPayloadCandidate,
  resolveCiLitePendingRunMessage,
  resolveHydratedCiLiteStepInfo,
  resolveCiLiteCompletionErrorText,
  getAutofixChainSkipReason,
  resolveCiLiteDisplaySnapshot,
  resolveCiLiteTargetRef,
  resolveCiLiteLookupFailureLabel,
  resolveCiLiteLookupTimeoutMs,
  hasCiLiteLookupTimedOut,
  getCiLiteWorkflowErrorMessage,
  resolveCiLiteWorkflowErrorFallback,
  mergeWorkflowRunLookupDiagnosis,
  resolveCiLiteLookupFailureMessage,
};

export type {
  ArtifactFetchContextInput,
  CiLiteArtifactJson,
  CiLiteStepInfo,
};

export const resolveCiLiteBusyState = (params: {
  dispatching: boolean;
  locatingRun: boolean;
  chainWaiting: boolean;
  logsLoading: boolean;
  workflowStatus: string | null | undefined;
}): boolean => {
  return (
    params.dispatching ||
    params.locatingRun ||
    params.chainWaiting ||
    params.logsLoading ||
    params.workflowStatus === "in_progress" ||
    params.workflowStatus === "queued"
  );
};

export const isCiLiteRunContextActive = (params: {
  dispatching: boolean;
  locatingRun: boolean;
  chainWaiting: boolean;
  runId: number | null | undefined;
}): boolean => {
  return (
    params.dispatching ||
    params.locatingRun ||
    params.chainWaiting ||
    params.runId != null
  );
};

export const resolveCiLiteLogLines = (params: {
  runId: number | null | undefined;
  logs: Array<{ message: string }> | null | undefined;
  hydratedDisplaySnapshotPresent: boolean;
  chainWaiting: boolean;
  workflowId: string;
  jobId: string | null;
}): string[] => {
  if (!params.runId) {
    if (params.hydratedDisplaySnapshotPresent) return [];
    return [
      resolveCiLitePendingRunMessage({
        chainWaiting: params.chainWaiting,
        workflowId: params.workflowId,
        jobId: params.jobId,
      }),
    ];
  }
  if (!params.logs || params.logs.length === 0) return [];
  return params.logs.map((entry) => entry.message);
};

export const parseCiLiteArtifactJson = (payload: unknown): CiLiteArtifactJson => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Artifact JSON missing or invalid");
  }

  const src = payload as Record<string, unknown>;
  const readNum = (k: "eslint_exit" | "tsc_exit"): number | undefined =>
    typeof src[k] === "number" ? src[k] : undefined;
  const readSha = (k: "source_commit_sha" | "source_sha" | "github_sha"): string | undefined =>
    typeof src[k] === "string" ? src[k].trim() || undefined : undefined;

  return {
    ok: typeof src.ok === "boolean" ? src.ok : Boolean(src.ok),
    eslint_exit: readNum("eslint_exit"),
    tsc_exit: readNum("tsc_exit"),
    source_commit_sha: readSha("source_commit_sha"),
    source_sha: readSha("source_sha"),
    github_sha: readSha("github_sha"),
  };
};
