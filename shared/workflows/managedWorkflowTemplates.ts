// Auto-managed GitHub Actions workflow templates for project repos.
import { WORKFLOW_K1W1_CI_LITE_AUTOFIX_TEMPLATE } from "./templates/ciLiteAutofixTemplate";
import { WORKFLOW_K1W1_CI_LITE_TEMPLATE } from "./templates/ciLiteTemplate";
import { WORKFLOW_K1W1_DIAGNOSTICS_TEMPLATE } from "./templates/k1w1DiagnosticsTemplate";

export {
  CI_LITE_WORKFLOW_VERSION,
  CI_LITE_WORKFLOW_VERSION_MARKER,
  MANAGED_BY_MARKER,
} from "./templateContracts";

export const WORKFLOW_TEMPLATES: Record<string, string> = {
  "k1w1-diagnostics.yml": WORKFLOW_K1W1_DIAGNOSTICS_TEMPLATE,
  "k1w1-ci-lite.yml": WORKFLOW_K1W1_CI_LITE_TEMPLATE,
  "k1w1-ci-lite-autofix.yml": WORKFLOW_K1W1_CI_LITE_AUTOFIX_TEMPLATE,
};

export const isKnownWorkflowTemplate = (fileName: string) => Boolean(WORKFLOW_TEMPLATES[fileName]);
