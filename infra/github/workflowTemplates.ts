import { WORKFLOW_TEMPLATES } from "../../shared/workflows/managedWorkflowTemplates";

export { WORKFLOW_TEMPLATES } from "../../shared/workflows/managedWorkflowTemplates";

export const isKnownWorkflowTemplate = (fileName: string) => Boolean(WORKFLOW_TEMPLATES[fileName]);
