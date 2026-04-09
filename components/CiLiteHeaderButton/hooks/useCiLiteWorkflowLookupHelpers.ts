import type { WorkflowRunLookupDiagnosis } from "./workflowRunMatching";
import { buildCiLiteLookupFailureMessage } from "./ciLiteWorkflowErrors";

export const resolveCiLiteLookupFailureLabel = (mode: "chain" | "default"): string => {
  return mode === "chain" ? "Autofix-Chain → CI Lite" : "Workflow";
};

export const resolveCiLiteLookupTimeoutMs = (mode: "chain" | "default"): number => {
  return mode === "chain" ? 75_000 : 60_000;
};

export const hasCiLiteLookupTimedOut = (params: {
  startedAtMs: number;
  mode: "chain" | "default";
  nowMs?: number;
}): boolean => {
  const now = params.nowMs ?? Date.now();
  return now - params.startedAtMs > resolveCiLiteLookupTimeoutMs(params.mode);
};

export const getCiLiteWorkflowErrorMessage = (error: unknown, fallback = ""): string => {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }
  if (typeof error === "string") return error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
};

export const resolveCiLiteWorkflowErrorFallback = (
  error: unknown,
  fallback = "Workflow-Lookup fehlgeschlagen. Bitte erneut versuchen.",
): string => {
  if (error instanceof Error && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

export const mergeWorkflowRunLookupDiagnosis = (
  previous: WorkflowRunLookupDiagnosis | null,
  next: WorkflowRunLookupDiagnosis | null,
): WorkflowRunLookupDiagnosis | null => {
  if (!next) return previous;
  if (!previous) return next;

  if (next.exactJobIdMatchFound || next.selectedTier) {
    return next;
  }

  if (!next.contractMismatchLikely && !next.ambiguous) {
    if (previous.contractMismatchLikely || previous.ambiguous) {
      return {
        ...next,
        ambiguous: previous.ambiguous || next.ambiguous,
        contractMismatchLikely: previous.contractMismatchLikely || next.contractMismatchLikely,
        fallbackCandidateCount: Math.max(previous.fallbackCandidateCount, next.fallbackCandidateCount),
        plausibleCandidateCount: Math.max(previous.plausibleCandidateCount, next.plausibleCandidateCount),
      };
    }
  }

  return next;
};

export const resolveCiLiteLookupFailureMessage = (params: {
  diagnosis: WorkflowRunLookupDiagnosis | null;
  workflowLabel: string;
}): string => {
  const { diagnosis, workflowLabel } = params;
  if (diagnosis?.ambiguous) {
    return buildCiLiteLookupFailureMessage({ workflowLabel, kind: "ambiguous" });
  }
  if (diagnosis?.contractMismatchLikely) {
    return buildCiLiteLookupFailureMessage({
      workflowLabel,
      kind: "contract_mismatch",
      hasExistingRunCandidate:
        diagnosis.plausibleCandidateCount > 0 || diagnosis.fallbackCandidateCount > 0,
    });
  }
  return buildCiLiteLookupFailureMessage({ workflowLabel, kind: "timeout" });
};
