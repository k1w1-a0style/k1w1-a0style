import { createOrUpdateFile, getRepoFileText } from "../infra/github/files";
import { WORKFLOW_TEMPLATES } from "../shared/workflows/managedWorkflowTemplates";

export const CI_LITE_WORKFLOW_FILE = "k1w1-ci-lite.yml" as const;
const CI_LITE_WORKFLOW_PATH = `.github/workflows/${CI_LITE_WORKFLOW_FILE}` as const;

export type CiLiteWorkflowBootstrapResult = {
  status: "created" | "repaired" | "current";
  workflowFile: string;
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

export async function ensureCiLiteWorkflowBootstrap(params: {
  owner: string;
  repo: string;
  branch: string;
}): Promise<CiLiteWorkflowBootstrapResult> {
  const template = WORKFLOW_TEMPLATES[CI_LITE_WORKFLOW_FILE];
  const normalizedTemplate = normalizeContent(template);

  let current = "";
  let missing = false;
  try {
    current = await getRepoFileText({ owner: params.owner, repo: params.repo, path: CI_LITE_WORKFLOW_PATH, ref: params.branch });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
      missing = true;
      current = "";
    } else {
      throw error;
    }
  }

  const normalizedCurrent = normalizeContent(current);
  if (!missing && normalizedCurrent === normalizedTemplate) {
    return { status: "current", workflowFile: CI_LITE_WORKFLOW_FILE };
  }

  if (!missing && !isManagedCiLiteWorkflow(normalizedCurrent)) {
    throw new Error(
      "CI-Lite Workflow ist vorhanden, aber nicht als managed k1w1-Workflow markiert. Automatische Reparatur wurde aus Sicherheitsgründen nicht durchgeführt.",
    );
  }

  if (!missing && !hasRequiredDispatchInputs(normalizedCurrent)) {
    await createOrUpdateFile(
      params.owner,
      params.repo,
      CI_LITE_WORKFLOW_PATH,
      `${template}`.replace(/\r\n/g, "\n"),
      `fix(ci-lite): repair ${CI_LITE_WORKFLOW_FILE}`,
      params.branch,
    );
    return { status: "repaired", workflowFile: CI_LITE_WORKFLOW_FILE };
  }

  if (missing || normalizedCurrent !== normalizedTemplate) {
    await createOrUpdateFile(
      params.owner,
      params.repo,
      CI_LITE_WORKFLOW_PATH,
      `${template}`.replace(/\r\n/g, "\n"),
      missing ? `chore(ci-lite): bootstrap ${CI_LITE_WORKFLOW_FILE}` : `fix(ci-lite): sync ${CI_LITE_WORKFLOW_FILE}`,
      params.branch,
    );
    return { status: missing ? "created" : "repaired", workflowFile: CI_LITE_WORKFLOW_FILE };
  }

  return { status: "current", workflowFile: CI_LITE_WORKFLOW_FILE };
}
