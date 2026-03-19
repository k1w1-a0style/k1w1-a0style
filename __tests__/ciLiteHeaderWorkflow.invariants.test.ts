import fs from "fs";
import path from "path";

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("CI Lite Header workflow invariants", () => {
  it("guards dispatch against double-tap while a dispatch is in-flight", () => {
    const src = read("components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts");

    expect(src).toContain("if (dispatching) return;");
  });

  it("persists CI-Lite outcome only for the active CI-Lite run context", () => {
    const src = read("components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts");

    expect(src).toContain("if (runId == null || workflowRun.id !== runId) return;");
    expect(src).toContain("if (!githubRepo || !targetRef || targetRef.trim() !== branch.trim()) return;");
  });

  it("uses typed head_sha fallback from WorkflowRun instead of any-cast", () => {
    const src = read("components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts");
    const workflowType = read("shared/types/workflowRun.ts");

    expect(src).toContain("workflowRun?.head_sha");
    expect(src).not.toContain("(workflowRun as any)?.head_sha");
    expect(workflowType).toContain("head_sha?: string;");
  });

  it("keeps CI-Lite chain coupling explicit and prefers source head_sha before title markers", () => {
    const src = read("components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts");

    expect(src).toContain("sourceHeadSha: workflowRun.head_sha ?? null");
    expect(src).toContain("requireJobIdMarker: false");
    expect(src).toContain("Manual workflow_dispatch still requires the explicit job_id marker");
    expect(src).toContain("Autofix-Chain ausgelöst, aber kein frischer passender CI-Lite-Run gefunden (Timeout)");
  });

  it("requires workflow event + branch to match before binding a located run", () => {
    const src = read("components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts");

    expect(src).toContain('const workflowLookupNote = typeof json?.note === "string" ? json.note.trim() : "";');
    expect(src).toContain("Workflow-Run-Lookup ist nicht workflow-spezifisch abgesichert");
    expect(src).toContain('if (event && event !== opts.expectedEvent) return false;');
    expect(src).toContain('if (headBranch && headBranch !== targetBranch) return false;');
    expect(src).toContain('expectedEvent: "repository_dispatch"');
    expect(src).toContain('expectedEvent: "workflow_dispatch"');
  });
});
