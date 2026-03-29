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
