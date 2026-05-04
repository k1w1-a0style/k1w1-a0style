import fs from "node:fs";
import path from "node:path";

const read = (rel: string) =>
  fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("patch 613 dispatch/bootstrap separation invariants", () => {
  it("keeps infra triggerWorkflow dispatch-only (no implicit repo writes)", () => {
    const src = read("infra/github/workflows.ts");
    expect(src).not.toContain("createOrUpdateFile(");
    expect(src).toContain("missing_workflow:");
    expect(src).toContain("Dispatch bleibt fail-closed ohne Repo-Mutation.");
  });

  it("keeps edge github-workflow-dispatch mutation-free in normal dispatch flow", () => {
    const src = read("supabase/functions/github-workflow-dispatch/index.ts");
    expect(src).not.toContain("ensureWorkflowFileExists(");
    expect(src).not.toContain("bootstrapped:");
    expect(src).toContain("missing_workflow");
    expect(src).toContain("Dispatch is mutation-free");
  });

  it("keeps CI Lite client dispatch path free of bootstrap/repair writes", () => {
    const src = read("components/CiLiteHeaderButton/hooks/useCiLiteDispatch.ts");
    expect(src).not.toContain("ensureCiLiteWorkflowBootstrap(");
    expect(src).not.toContain("createOrUpdateFile(");
  });
});
