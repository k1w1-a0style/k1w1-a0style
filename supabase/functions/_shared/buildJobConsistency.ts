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
