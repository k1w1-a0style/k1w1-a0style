import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("patch602 ci-lite smoke jwt/ref contract", () => {
  it("requires workflow jwt in ci-lite env loader", () => {
    const script = read("scripts/ci-lite-env-load.sh");
    expect(script).toContain('WORKFLOW_JWT="${K1W1_EDGE_WORKFLOW_JWT:-}"');
    expect(script).toContain("Missing required K1W1_EDGE_WORKFLOW_JWT");
    expect(script).toContain("K1W1_EDGE_WORKFLOW_JWT=[SET]");
  });

  it("requires explicit ref and bearer jwt in ci-lite smoke", () => {
    const script = read("scripts/ci-lite-smoke.sh");
    expect(script).toContain('REF="${3:-}"');
    expect(script).not.toContain('REF="${3:-main}"');
    expect(script).toContain("Usage: $0 <owner/repo> <workflow.yml> <ref>");
    expect(script).toContain('WORKFLOW_JWT="${K1W1_EDGE_WORKFLOW_JWT:-}"');
    expect(script).toContain("Missing required K1W1_EDGE_WORKFLOW_JWT");
    expect(script).toContain('-H "Authorization: Bearer ${WORKFLOW_JWT}"');
    expect(script).toContain('edge_post "github-workflow-dispatch"');
    expect(script).toContain('edge_post "github-workflow-runs"');
    expect(script).toContain('edge_post "github-workflow-logs"');
  });

  it("guards JWT/ref contract in workflow edge contract check", () => {
    const checkScript = read("scripts/check_workflow_edge_contracts.sh");
    expect(checkScript).toContain("require_fixed \"$CI_LITE_ENV_LOAD\" 'WORKFLOW_JWT=\"${K1W1_EDGE_WORKFLOW_JWT:-}\"'");
    expect(checkScript).toContain("require_fixed \"$CI_LITE_SMOKE\" 'WORKFLOW_JWT=\"${K1W1_EDGE_WORKFLOW_JWT:-}\"'");
    expect(checkScript).toContain("require_fixed \"$CI_LITE_SMOKE\" '-H \"Authorization: Bearer ${WORKFLOW_JWT}\"'");
    expect(checkScript).toContain("forbid_fixed \"$CI_LITE_SMOKE\" 'REF=\"${3:-main}\"'");
  });
});
