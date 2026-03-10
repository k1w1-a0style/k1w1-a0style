import fs from "fs";
import path from "path";

const workflowPath = path.join(
  process.cwd(),
  ".github/workflows/deploy-supabase-functions.yml",
);
const guardScriptPath = path.join(
  process.cwd(),
  "scripts/check_supabase_deploy_workflow.sh",
);

describe("Patch 411 Supabase deploy workflow invariants", () => {
  const workflowSrc = fs.readFileSync(workflowPath, "utf8");
  const guardSrc = fs.readFileSync(guardScriptPath, "utf8");

  it("does not auto-deploy on push", () => {
    expect(workflowSrc).not.toMatch(/^\s*push:\s*$/m);
  });

  it("uses workflow_dispatch with required ref input", () => {
    expect(workflowSrc).toContain("workflow_dispatch:");
    expect(workflowSrc).toContain("ref:");
    expect(workflowSrc).toMatch(/ref:\n\s+description:.*\n\s+required:\s*true/m);
  });

  it("supports apply_migrations policy input", () => {
    expect(workflowSrc).toContain("apply_migrations:");
    expect(workflowSrc).toContain('options: ["auto", "true", "false"]');
    expect(workflowSrc).toContain('default: "auto"');
  });

  it("blocks deploying _shared directly", () => {
    expect(workflowSrc).toContain('if [ "$FUNCTION_NAME" = "_shared" ]; then');
    expect(workflowSrc).toContain("Refusing to deploy reserved helper directory: _shared");
  });

  it("validates function_name with a safe regex", () => {
    expect(workflowSrc).toContain(
      "^[A-Za-z0-9_-]+$",
    );
  });

  it("runs supabase db push only behind explicit migration policy", () => {
    expect(workflowSrc).toContain("supabase db push");
    expect(workflowSrc).toContain("apply_migrations");
    expect(workflowSrc).toContain("migration_reason");
  });

  it("guard script enforces workflow_dispatch-only policy and migration guards", () => {
    expect(guardSrc).toContain("workflow_dispatch:");
    expect(guardSrc).toContain("apply_migrations");
    expect(guardSrc).toContain("supabase db push");
    expect(guardSrc).toContain("_shared");
  });
});
