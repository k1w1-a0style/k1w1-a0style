import { getBranchHeadSha, getDefaultBranch } from "../infra/github/branchOps";
import { createOrUpdateFile, getRepoFileText } from "../infra/github/files";
import { WORKFLOW_TEMPLATES } from "../shared/workflows/managedWorkflowTemplates";

export type CiLiteWorkflowBootstrapStatus = "created" | "repaired" | "current" | "skipped_tokenless" | "skipped_unknown_workflow";
export type CiLiteWorkflowBranchStatus = "missing" | "current" | "stale" | "unmanaged";

type WorkflowReadStatus = { status: CiLiteWorkflowBranchStatus; content: string };

export type CiLiteWorkflowBootstrapResult = {
  status: CiLiteWorkflowBootstrapStatus;
  workflowFile: string;
  targetRepo: string;
  targetBranch: string;
  defaultBranch: string | null;
  workflowDefinitionBranch: string | null;
  targetBranchWorkflowStatus: CiLiteWorkflowBranchStatus | "unknown";
  defaultBranchWorkflowStatus: CiLiteWorkflowBranchStatus | "unknown";
  hasWorkflowDispatch: boolean;
  hasRequiredInputs: boolean;
  githubIndexMayLag: boolean;
  recommendedWaitSeconds: number;
  warning?: string;
};

function normalizeContent(content: string): string {
  return String(content ?? "").replace(/\r\n/g, "\n").trim();
}

function isManagedCiLiteWorkflow(content: string): boolean {
  return content.includes("# managed-by: k1w1") && content.includes("# workflow-version:");
}

function hasWorkflowDispatch(content: string): boolean {
  return normalizeContent(content).includes("workflow_dispatch:");
}

function hasRequiredDispatchInputs(content: string): boolean {
  const normalized = normalizeContent(content);
  return hasWorkflowDispatch(normalized) && normalized.includes("job_id:") && normalized.includes("ref:");
}

export function isLocalGithubAuthUnavailableError(message: string): boolean {
  const lower = String(message || "").toLowerCase();
  return (
    lower.includes("missing github token") ||
    lower.includes("github token fehlt") ||
    lower.includes("token ungültig") ||
    lower.includes("bad credentials") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden") ||
    lower.includes("keine berechtigung") ||
    lower.includes("requires github token") ||
    /\b401\b/.test(lower) ||
    /\b403\b/.test(lower)
  );
}

function buildTokenlessResult(base: Omit<CiLiteWorkflowBootstrapResult, "status" | "warning">): CiLiteWorkflowBootstrapResult {
  return {
    status: "skipped_tokenless",
    ...base,
    warning: "CI-Lite bootstrap skipped locally (GitHub auth unavailable/invalid). Dispatch continues via Edge path.",
  };
}

async function readWorkflowStatus(params: {
  owner: string;
  repo: string;
  branch: string;
  workflowPath: string;
  normalizedTemplate: string;
}): Promise<WorkflowReadStatus> {
  try {
    const content = await getRepoFileText({ owner: params.owner, repo: params.repo, path: params.workflowPath, ref: params.branch });
    const normalized = normalizeContent(content);
    if (!normalized) return { status: "missing", content: "" };
    if (!isManagedCiLiteWorkflow(normalized)) return { status: "unmanaged", content: normalized };
    return { status: normalized === params.normalizedTemplate ? "current" : "stale", content: normalized };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("404") || /not found/i.test(message)) {
      return { status: "missing", content: "" };
    }
    throw error;
  }
}

export async function ensureCiLiteWorkflowBootstrap(params: {
  owner: string;
  repo: string;
  branch: string;
  workflowFile: string;
}): Promise<CiLiteWorkflowBootstrapResult> {
  const { owner, repo, branch: targetBranch, workflowFile } = params;
  const targetRepo = `${owner}/${repo}`;
  const template = WORKFLOW_TEMPLATES[workflowFile];

  const base: Omit<CiLiteWorkflowBootstrapResult, "status" | "warning"> = {
    workflowFile,
    targetRepo,
    targetBranch,
    defaultBranch: null,
    workflowDefinitionBranch: null,
    targetBranchWorkflowStatus: "unknown",
    defaultBranchWorkflowStatus: "unknown",
    hasWorkflowDispatch: false,
    hasRequiredInputs: false,
    githubIndexMayLag: false,
    recommendedWaitSeconds: 60,
  };

  if (!template) {
    return {
      status: "skipped_unknown_workflow",
      ...base,
      warning: `CI-Lite bootstrap skipped: unmanaged workflow '${workflowFile}'.`,
    };
  }

  const workflowPath = `.github/workflows/${workflowFile}`;
  const normalizedTemplate = normalizeContent(template);

  try {
    await getBranchHeadSha(owner, repo, targetBranch);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (isLocalGithubAuthUnavailableError(message)) {
      return buildTokenlessResult(base);
    }
    throw new Error(`CI-Lite target branch '${targetBranch}' does not exist or is not readable.`);
  }

  let defaultBranch: string;
  try {
    defaultBranch = await getDefaultBranch(owner, repo);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (isLocalGithubAuthUnavailableError(message)) {
      return buildTokenlessResult(base);
    }
    throw error;
  }

  const workflowDefinitionBranch = defaultBranch;

  const defaultBranchWorkflow = await readWorkflowStatus({
    owner,
    repo,
    branch: workflowDefinitionBranch,
    workflowPath,
    normalizedTemplate,
  });

  const targetBranchWorkflow = targetBranch === workflowDefinitionBranch
    ? defaultBranchWorkflow
    : await readWorkflowStatus({
      owner,
      repo,
      branch: targetBranch,
      workflowPath,
      normalizedTemplate,
    });

  const diagnostics: Omit<CiLiteWorkflowBootstrapResult, "status" | "warning"> = {
    ...base,
    defaultBranch,
    workflowDefinitionBranch,
    targetBranchWorkflowStatus: targetBranchWorkflow.status,
    defaultBranchWorkflowStatus: defaultBranchWorkflow.status,
    hasWorkflowDispatch: hasWorkflowDispatch(defaultBranchWorkflow.content),
    hasRequiredInputs: hasRequiredDispatchInputs(defaultBranchWorkflow.content),
  };

  if (defaultBranchWorkflow.status === "unmanaged") {
    throw new Error(`CI-Lite Workflow '${workflowFile}' exists on definition branch '${workflowDefinitionBranch}' but is unmanaged. Auto-repair aborted.`);
  }
  if (targetBranchWorkflow.status === "unmanaged") {
    throw new Error(`CI-Lite Workflow '${workflowFile}' exists on target branch '${targetBranch}' but is unmanaged. Auto-repair aborted.`);
  }

  let status: CiLiteWorkflowBootstrapStatus = "current";

  if (defaultBranchWorkflow.status !== "current" || !hasRequiredDispatchInputs(defaultBranchWorkflow.content)) {
    await createOrUpdateFile(
      owner,
      repo,
      workflowPath,
      `${template}`.replace(/\r\n/g, "\n"),
      defaultBranchWorkflow.status === "missing" ? `chore(ci-lite): bootstrap ${workflowFile}` : `fix(ci-lite): repair ${workflowFile}`,
      workflowDefinitionBranch,
    );
    status = defaultBranchWorkflow.status === "missing" ? "created" : "repaired";
  }

  const targetNeedsUpdate =
    targetBranch !== workflowDefinitionBranch &&
    (targetBranchWorkflow.status === "missing" || targetBranchWorkflow.status === "stale" || !hasRequiredDispatchInputs(targetBranchWorkflow.content));

  if (targetNeedsUpdate) {
    await createOrUpdateFile(
      owner,
      repo,
      workflowPath,
      `${template}`.replace(/\r\n/g, "\n"),
      targetBranchWorkflow.status === "missing" ? `chore(ci-lite): bootstrap ${workflowFile}` : `fix(ci-lite): repair ${workflowFile}`,
      targetBranch,
    );
    if (status === "current") {
      status = targetBranchWorkflow.status === "missing" ? "created" : "repaired";
    }
  }

  const changed = status !== "current";

  return {
    ...diagnostics,
    status,
    githubIndexMayLag: changed,
    recommendedWaitSeconds: changed ? 60 : 0,
  };
}
