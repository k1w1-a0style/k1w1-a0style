export function buildDispatchFailurePatch(input: {
  statusCode: number;
  sourceCommitSha?: string | null;
  nowIso?: string;
}) {
  return {
    status: "error",
    completed_at: input.nowIso ?? new Date().toISOString(),
    error_message: `dispatch_failed:${input.statusCode}`,
    source_commit_sha: input.sourceCommitSha ?? null,
  };
}

export function mapGitHubRunToBuildStatus(
  status: string | null | undefined,
  conclusion: string | null | undefined,
): "completed" | "error" | null {
  if ((status ?? "").toLowerCase() !== "completed") return null;
  return (conclusion ?? "").toLowerCase() === "success" ? "completed" : "error";
}

export function shouldReconcileBuildStatus(
  currentStatus: string | null | undefined,
  mappedStatus: "completed" | "error" | null,
): boolean {
  if (!mappedStatus) return false;
  const current = (currentStatus ?? "").toLowerCase();
  return !["completed", "error", "failed", "cancelled"].includes(current);
}

export function resolveDispatchRef(branch: string, sourceCommitSha?: string | null): string {
  const sha = (sourceCommitSha ?? "").trim();
  return sha || branch;
}

export function buildReconciliationPatch(input: {
  currentStatus?: string | null;
  runStatus?: string | null;
  runConclusion?: string | null;
  existingErrorMessage?: string | null;
  nowIso?: string;
}): { nextStatus: "completed" | "error"; patch: Record<string, unknown> } | null {
  const mapped = mapGitHubRunToBuildStatus(input.runStatus, input.runConclusion);
  if (!shouldReconcileBuildStatus(input.currentStatus, mapped) || !mapped) return null;
  return {
    nextStatus: mapped,
    patch: {
      status: mapped,
      completed_at: input.nowIso ?? new Date().toISOString(),
      error_message: mapped === "error"
        ? (input.existingErrorMessage ?? "Reconciled from GitHub terminal state")
        : input.existingErrorMessage ?? null,
    },
  };
}
