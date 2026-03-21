import {
  WORKFLOW_EAS_BUILD,
  WORKFLOW_EAS_LINK,
  WORKFLOW_K1W1_TRIGGERED_BUILD,
  WORKFLOW_RELEASE_BUILD,
} from "./workflowTemplates";
import { WORKFLOW_TEMPLATES } from "../../infra/github/workflowTemplates";

// Single registry for the workflow files that diagnostics/auto-fix may write into
// linked target repos. It intentionally bridges the historical diagnostics EAS/build
// templates and the infra CI Lite templates so those paths cannot drift silently.
const AUTO_FIX_MANAGED_WORKFLOW_TEMPLATE_SOURCES = {
  "k1w1-triggered-build.yml": WORKFLOW_K1W1_TRIGGERED_BUILD,
  "eas-build.yml": WORKFLOW_EAS_BUILD,
  "release-build.yml": WORKFLOW_RELEASE_BUILD,
  "eas-link.yml": WORKFLOW_EAS_LINK,
  "k1w1-ci-lite.yml": WORKFLOW_TEMPLATES["k1w1-ci-lite.yml"],
  "k1w1-ci-lite-autofix.yml": WORKFLOW_TEMPLATES["k1w1-ci-lite-autofix.yml"],
} as const;

export const AUTO_FIX_MANAGED_WORKFLOW_FILES = Object.keys(
  AUTO_FIX_MANAGED_WORKFLOW_TEMPLATE_SOURCES,
) as Array<keyof typeof AUTO_FIX_MANAGED_WORKFLOW_TEMPLATE_SOURCES>;

export type AutoFixManagedWorkflowFile =
  (typeof AUTO_FIX_MANAGED_WORKFLOW_FILES)[number];

export type ManagedWorkflowDefinition = {
  fileName: AutoFixManagedWorkflowFile;
  path: `.github/workflows/${AutoFixManagedWorkflowFile}`;
  content: string;
};

export type ManagedWorkflowDetectedState = "missing" | "drifted" | "current";

const normalizeWorkflowContent = (content: string): string =>
  String(content ?? "").replace(/\r\n/g, "\n").trim();

const resolveManagedWorkflowContent = (
  fileName: AutoFixManagedWorkflowFile,
): string => {
  const content = AUTO_FIX_MANAGED_WORKFLOW_TEMPLATE_SOURCES[fileName];

  if (!content) {
    throw new Error(
      `Managed workflow registry misconfigured: missing template for ${fileName}`,
    );
  }

  return content;
};

export const getAutoFixManagedWorkflowDefinitions = (): ManagedWorkflowDefinition[] =>
  AUTO_FIX_MANAGED_WORKFLOW_FILES.map((fileName) => ({
    fileName,
    path: `.github/workflows/${fileName}`,
    content: resolveManagedWorkflowContent(fileName),
  }));

export const classifyManagedWorkflowState = (params: {
  currentContent: string;
  desiredContent: string;
}): ManagedWorkflowDetectedState => {
  const current = normalizeWorkflowContent(params.currentContent);
  const desired = normalizeWorkflowContent(params.desiredContent);

  if (!current) return "missing";
  if (current === desired) return "current";
  return "drifted";
};
