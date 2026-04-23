import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("EAS manual-trigger + strict-lockfile drift checks", () => {
  it("checks manual-trigger controls against live workflows plus shared SoT templates", () => {
    const src = read("scripts/check_eas_manual_trigger_controls.sh");
    expect(src).toContain('SHARED_EAS_RELEASE="shared/workflows/easBuildReleaseWorkflowTemplates.ts"');
    expect(src).toContain('SHARED_TRIGGERED="shared/workflows/k1w1TriggeredBuildWorkflowTemplate.ts"');
    expect(src).toContain('WORKFLOW_EAS_BUILD_TEMPLATE');
    expect(src).toContain('WORKFLOW_K1W1_TRIGGERED_BUILD_TEMPLATE');
    expect(src).not.toContain('grep -q "strict_lockfile" lib/diagnostics/workflowTemplates.ts');
  });

  it("checks strict lockfile policy against shared EAS template SoT and diagnostics wiring", () => {
    const src = read("scripts/check_eas_strict_lockfile_policy.sh");
    expect(src).toContain('SHARED_TPL="shared/workflows/easBuildReleaseWorkflowTemplates.ts"');
    expect(src).toContain('DIAG_TPL="lib/diagnostics/workflowTemplates.ts"');
    expect(src).toContain("release workflow missing strict lockfile policy step");
    expect(src).toContain("release workflow missing non-development strict_lockfile=false guard");
    expect(src).toContain("workflow missing non-development strict_lockfile=false guard");
    expect(src).toContain("workflow summary missing dependency install mode line");
    expect(src).toContain("release workflow summary missing dependency install mode line");
    expect(src).toContain("release workflow summary strict lockfile bullet must be its own echo line");
    expect(src).toContain("release workflow summary dependency install mode bullet must be its own echo line");
    expect(src).toContain("shared template missing strict lockfile policy step");
    expect(src).toContain("WORKFLOW_EAS_BUILD_TEMPLATE");
    expect(src).toContain("WORKFLOW_EAS_BUILD = WORKFLOW_EAS_BUILD_TEMPLATE");
    expect(src).not.toContain('\nTPL="lib/diagnostics/workflowTemplates.ts"');
  });
});
