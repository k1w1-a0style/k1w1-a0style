import fs from "fs";

const read = (p: string) => fs.readFileSync(p, "utf8");

describe("patch 399 managed workflow drift invariants", () => {
  it("CI Lite workflow is managed and versioned", () => {
    const ci = read(".github/workflows/k1w1-ci-lite.yml");
    expect(ci).toContain("# managed-by: k1w1");
    expect(ci).toContain("# workflow-version: 399");
    expect(ci).toContain('WORKFLOW_VERSION: "399"');
  });

  it("CI Lite Autofix workflow is managed and versioned", () => {
    const autofix = read(".github/workflows/k1w1-ci-lite-autofix.yml");
    expect(autofix).toContain("# managed-by: k1w1");
    expect(autofix).toContain("# workflow-version: 399");
    expect(autofix).toContain('WORKFLOW_VERSION: "399"');
  });

  it("template sources carry managed workflow markers", () => {
    const shared = read("shared/workflows/managedWorkflowTemplates.ts");
    const ciLiteTemplate = read("shared/workflows/templates/ciLiteTemplate.ts");
    const ciLiteAutofixTemplate = read("shared/workflows/templates/ciLiteAutofixTemplate.ts");
    const infra = read("infra/github/workflowTemplates.ts");
    const edge = read("supabase/functions/github-workflow-dispatch/index.ts");

    expect(shared).toContain('"k1w1-ci-lite.yml": WORKFLOW_K1W1_CI_LITE_TEMPLATE');
    expect(shared).toContain('"k1w1-ci-lite-autofix.yml": WORKFLOW_K1W1_CI_LITE_AUTOFIX_TEMPLATE');
    expect(ciLiteTemplate).toContain("# managed-by: k1w1");
    expect(ciLiteTemplate).toContain("# workflow-version: 399");
    expect(ciLiteAutofixTemplate).toContain("# managed-by: k1w1");
    expect(ciLiteAutofixTemplate).toContain("# workflow-version: 399");
    expect(infra).toContain("managedWorkflowTemplates");
    expect(edge).not.toContain("managedWorkflowTemplates");
    expect(edge).toContain("missing_workflow");
  });
});
