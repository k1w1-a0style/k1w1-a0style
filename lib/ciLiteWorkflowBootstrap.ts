import { createOrUpdateFile, getRepoFileText } from "../infra/github/files";
import { WORKFLOW_TEMPLATES } from "../shared/workflows/managedWorkflowTemplates";

export type CiLiteWorkflowBootstrapStatus = "created" | "repaired" | "current" | "skipped_tokenless" | "skipped_unknown_workflow";

export type CiLiteWorkflowBootstrapResult = {
  status: CiLiteWorkflowBootstrapStatus;
  workflowFile: string;
  warning?: string;
};

function normalizeContent(content: string): string {
  return String(content ?? "").replace(/\r\n/g, "\n").trim();
}

function isManagedCiLiteWorkflow(content: string): boolean {
  return content.includes("# managed-by: k1w1") && content.includes("# workflow-version:");
}

function hasRequiredDispatchInputs(content: string): boolean {
  const normalized = normalizeContent(content);
  return normalized.includes("workflow_dispatch:") && normalized.includes("job_id:") && normalized.includes("ref:");
}

function isTokenlessLocalAccessError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("github token fehlt") || lower.includes("missing github token") || lower.includes("requires github token");
}

export async function ensureCiLiteWorkflowBootstrap(params: {
  owner: string;
  repo: string;
  branch: string;
  workflowFile: string;
}): Promise<CiLiteWorkflowBootstrapResult> {
  const template = WORKFLOW_TEMPLATES[params.workflowFile];
  if (!template) {
    return {
      status: "skipped_unknown_workflow",
      workflowFile: params.workflowFile,
      warning: `CI-Lite bootstrap skipped: unmanaged workflow '${params.workflowFile}'.`,
    };
  }

  const workflowPath = `.github/workflows/${params.workflowFile}`;
  const normalizedTemplate = normalizeContent(template);

  let current = "";
  let missing = false;
  try {
    current = await getRepoFileText({ owner: params.owner, repo: params.repo, path: workflowPath, ref: params.branch });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
      missing = true;
      current = "";
    } else if (isTokenlessLocalAccessError(msg)) {
      return {
        status: "skipped_tokenless",
        workflowFile: params.workflowFile,
        warning: "CI-Lite bootstrap skipped locally (GitHub token unavailable). Dispatch continues via Edge path.",
      };
    } else {
      throw error;
    }
  }

  const normalizedCurrent = normalizeContent(current);
  if (!missing && normalizedCurrent === normalizedTemplate) {
    return { status: "current", workflowFile: params.workflowFile };
  }

  if (!missing && !isManagedCiLiteWorkflow(normalizedCurrent)) {
    throw new Error(
      `CI-Lite Workflow '${params.workflowFile}' ist vorhanden, aber nicht als managed k1w1-Workflow markiert. Automatische Reparatur wurde aus Sicherheitsgründen nicht durchgeführt.`,
    );
  }

  if (!missing && !hasRequiredDispatchInputs(normalizedCurrent)) {
    await createOrUpdateFile(
      params.owner,
      params.repo,
      workflowPath,
      `${template}`.replace(/\r\n/g, "\n"),
      `fix(ci-lite): repair ${params.workflowFile}`,
      params.branch,
    );
    return { status: "repaired", workflowFile: params.workflowFile };
  }

  if (missing || normalizedCurrent !== normalizedTemplate) {
    await createOrUpdateFile(
      params.owner,
      params.repo,
      workflowPath,
      `${template}`.replace(/\r\n/g, "\n"),
      missing ? `chore(ci-lite): bootstrap ${params.workflowFile}` : `fix(ci-lite): sync ${params.workflowFile}`,
      params.branch,
    );
    return { status: missing ? "created" : "repaired", workflowFile: params.workflowFile };
  }

  return { status: "current", workflowFile: params.workflowFile };
}
