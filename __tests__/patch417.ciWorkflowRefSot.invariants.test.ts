import fs from "fs";
import path from "path";
import ts from "typescript";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

const parseTs = (src: string, fileName: string) =>
  ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const extractExportedStringConst = (src: string, fileName: string, name: string) => {
  const parsed = parseTs(src, fileName);

  for (const stmt of parsed.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    if (!stmt.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;

    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || decl.name.text !== name || !decl.initializer) continue;

      if (ts.isStringLiteral(decl.initializer) || ts.isNoSubstitutionTemplateLiteral(decl.initializer)) {
        return decl.initializer.text;
      }

      throw new Error(`${name} must be a plain string literal or a no-substitution template literal.`);
    }
  }

  return "";
};

const extractTemplateContent = (jsonSrc: string, workflowPath: string) => {
  const entries = JSON.parse(jsonSrc) as Array<{ path: string; content: string }>;
  return entries.find((entry) => entry.path === workflowPath)?.content ?? "";
};

const normalize = (src: string) => src.replace(/\r\n/g, "\n");

describe("Patch 417 CI utility workflow ref SoT invariants", () => {
  it("hardens the live CI utility workflows to explicit manual refs", () => {
    const ciBuild = read(".github/workflows/ci-build.yml");
    const ciCore = read(".github/workflows/ci-core.yml");
    const ci = read(".github/workflows/ci.yml");
    const lint = read(".github/workflows/workflow-lint.yml");
    const easLink = read(".github/workflows/eas-link.yml");

    expect(ciBuild).toContain('required: true');
    expect(ciBuild).not.toContain('default: ""');
    expect(ciBuild).toContain('needs: resolve');
    expect(ciBuild).toContain('ref: ${{ needs.resolve.outputs.ref }}');
    expect(ciBuild).toContain('Missing required ref. Pass client_payload.ref for repository_dispatch or inputs.ref for workflow_dispatch.');

    expect(ciCore).toContain('required: true');
    expect(ciCore).toContain('ref: ${{ inputs.ref }}');
    expect(ciCore).not.toContain('ref: ${{ inputs.ref || github.ref }}');

    expect(ci).toContain('required: true');
    expect(ci).not.toContain('default: ""');
    expect(ci).toContain("ref: ${{ github.event_name == 'workflow_dispatch' && inputs.ref || github.ref }}");
    expect(ci).toContain("group: ci-${{ github.event_name == 'workflow_dispatch' && inputs.ref || github.ref }}");
    expect(ci).not.toContain('group: ci-${{ github.ref }}');
    expect(ci).not.toContain("inputs.ref != '' && inputs.ref || github.ref");

    expect(lint).toContain('required: true');
    expect(lint).not.toContain('default: ""');
    expect(lint).toContain('needs: resolve');
    expect(lint).toContain('ref: ${{ needs.resolve.outputs.ref }}');
    expect(lint).toContain('lib/diagnostics/workflowTemplates.ts');
    expect(lint).toContain('templates/expo-sdk54-base.json');
    expect(lint).toContain('Missing required ref. Pass client_payload.ref for repository_dispatch.');
    expect(lint).toContain('Missing required ref. Pass inputs.ref for workflow_dispatch.');
    expect(lint).not.toContain('github.event.client_payload.ref || inputs.ref || github.ref');

    expect(easLink).toContain('description: "Branch/Tag/SHA to link/init"');
    expect(easLink).toContain('required: true');
    expect(easLink).not.toContain('default: ""');
    expect(easLink).not.toContain('description: "Branch/Tag/SHA (optional)"');
  });

  it("keeps workflowTemplates.ts syntactically valid for embedded workflow imports", () => {
    const templatesTs = read("lib/diagnostics/workflowTemplates.ts");
    const parsed = parseTs(templatesTs, "workflowTemplates.ts");
    // parseDiagnostics is an internal TS compiler property not in the public type declaration
    const internalDiagnostics: ts.Diagnostic[] =
      (parsed as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics ?? [];
    const diagnostics = internalDiagnostics.map((diag) =>
      ts.flattenDiagnosticMessageText(diag.messageText, "\n"),
    );

    expect(diagnostics).toEqual([]);
  });

  it("keeps the embedded EAS Link templates exactly aligned with the live workflow", () => {
    const easLink = read(".github/workflows/eas-link.yml");
    const templatesTs = read("shared/workflows/easLinkWorkflowTemplate.ts");
    const diagnosticsTs = read("lib/diagnostics/workflowTemplates.ts");
    const baseJson = read("templates/expo-sdk54-base.json");

    const tsEasLink = extractExportedStringConst(
      templatesTs,
      "easLinkWorkflowTemplate.ts",
      "WORKFLOW_EAS_LINK_TEMPLATE",
    );
    const baseEasLink = extractTemplateContent(baseJson, ".github/workflows/eas-link.yml");

    expect(tsEasLink).toBeTruthy();
    expect(baseEasLink).toBeTruthy();
    expect(diagnosticsTs).toContain("WORKFLOW_EAS_LINK_TEMPLATE");
    expect(diagnosticsTs).toContain("export const WORKFLOW_EAS_LINK = WORKFLOW_EAS_LINK_TEMPLATE;");

    expect(normalize(tsEasLink)).toBe(normalize(easLink));
    expect(normalize(baseEasLink)).toBe(normalize(easLink));
  });

  it("keeps the workflow template drift guard aligned with the CI utility SoT", () => {
    const guard = read("scripts/check_workflow_template_drift.sh");
    expect(guard).toContain('for wf in .github/workflows/eas-link.yml .github/workflows/release-build.yml; do');
    expect(guard).not.toContain('.github/workflows/deploy-supabase-functions.yml; do');
    expect(guard).toContain('Shared WORKFLOW_EAS_LINK_TEMPLATE drifted from live .github/workflows/eas-link.yml');
    expect(guard).toContain('Shared WORKFLOW_K1W1_TRIGGERED_BUILD_TEMPLATE drifted from live .github/workflows/k1w1-triggered-build.yml');
    expect(guard).toContain('templates/expo-sdk54-base.json EAS Link entry drifted from live .github/workflows/eas-link.yml');
  });

  it("keeps managed-workflow guardrails against implicit ref fallbacks", () => {
    const managed = read("scripts/check_managed_workflows.sh");

    expect(managed).toContain('forbid_fixed');
    expect(managed).toContain('require_ref_input_required_true');
    expect(managed).toContain("Missing 'on.workflow_dispatch.inputs.ref.required: true' contract");
    expect(managed).not.toContain("grep -Eq '^\\s+required:\\s*true\\s*$'");
    expect(managed).toContain('.github/workflows/k1w1-triggered-build.yml');
    expect(managed).toContain('WORKFLOW_K1W1_TRIGGERED_BUILD_TEMPLATE');
    expect(managed).toContain("ref: ${{ github.ref }}");
    expect(managed).toContain("ref: ${{ github.ref_name }}");
    expect(managed).toContain("github.head_ref");
    expect(managed).toContain("github.event.repository.default_branch");
    expect(managed).toContain("workflow_dispatch' && inputs.ref || github.ref");
    expect(managed).toContain('default_ref: work');
  });
});
