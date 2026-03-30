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
