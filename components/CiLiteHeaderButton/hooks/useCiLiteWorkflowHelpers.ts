import type { WorkflowRunLookupDiagnosis } from "./workflowRunMatching";
import { buildCiLiteLookupFailureMessage } from "./ciLiteWorkflowErrors";

export type ArtifactFetchContextInput = {
  githubRepo: string | null | undefined;
  workflowId: string | null | undefined;
  workflowRunId: number | null | undefined;
  workflowStatus: string | null | undefined;
};

export const buildArtifactFetchContextKey = (
  input: ArtifactFetchContextInput,
): string | null => {
  const repo = String(input.githubRepo ?? "").trim();
  const workflowId = String(input.workflowId ?? "").trim();
  const status = String(input.workflowStatus ?? "").trim();

  if (!repo || !workflowId || !input.workflowRunId || status !== "completed") {
    return null;
  }

  return `${repo}::${workflowId}::${String(input.workflowRunId)}`;
};

export const getAutofixChainSkipReason = (lines: string[]): string | null => {
  if (!Array.isArray(lines) || lines.length === 0) return null;
  const joined = lines.join("\n");

  if (/No\s+TARGET_BRANCH.*skipping\s+CI\s*Lite\s+chain-?run/i.test(joined)) {
    return "Kein TARGET_BRANCH im Autofix-Run";
  }
  if (/Ref\s+looks\s+like\s+a\s+SHA.*skipping\s+CI\s*Lite\s+chain-?run/i.test(joined)) {
    return "Ref wurde als SHA statt Branch erkannt";
  }
  if (/Unsafe\s+ref.*skipping\s+CI\s*Lite\s+chain-?run/i.test(joined)) {
    return "Ref enthält unsichere Zeichen";
  }
  if (/CI\s*Lite\s+chain-?run\s+disabled\s+for.*regex:/i.test(joined)) {
    return "Ref ist laut Workflow-Regeln nicht für Chain-Run erlaubt";
  }
  if (/is\s+not\s+a\s+remote\s+branch.*skipping\s+CI\s*Lite\s+chain-?run/i.test(joined)) {
    return "Ref existiert nicht als Remote-Branch";
  }

  return null;
};

export const splitRepoFullName = (
  repoFullName: string,
): { owner: string; repo: string } | null => {
  const [owner, repo] = String(repoFullName || "").trim().split("/");
  if (!owner || !repo) return null;
  return { owner, repo };
};

export const getCiLiteWorkflowErrorMessage = (
  error: unknown,
  fallback = "",
): string => {
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

export type CiLiteArtifactJson = {
  ok: boolean;
  eslint_exit?: number;
  tsc_exit?: number;
  source_commit_sha?: string;
  source_sha?: string;
  github_sha?: string;
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
