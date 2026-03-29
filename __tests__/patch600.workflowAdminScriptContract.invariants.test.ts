import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("patch600 workflow admin key contract for ci-lite scripts", () => {
  it("keeps ci-lite env load pinned to the dedicated workflow admin key", () => {
    const script = read("scripts/ci-lite-env-load.sh");
    expect(script).toContain('WORKFLOW_ADMIN="${K1W1_EDGE_WORKFLOW_ADMIN_KEY:-}"');
    expect(script).toContain("Missing required K1W1_EDGE_WORKFLOW_ADMIN_KEY");
    expect(script).not.toContain('WORKFLOW_ADMIN="${K1W1_EDGE_WORKFLOW_ADMIN_KEY:-${ADMIN_KEY:-${K1W1_EDGE_ADMIN_KEY:-}}}"');
  });

  it("keeps ci-lite smoke pinned to the dedicated workflow admin key", () => {
    const script = read("scripts/ci-lite-smoke.sh");
    expect(script).toContain('WORKFLOW_ADMIN="${K1W1_EDGE_WORKFLOW_ADMIN_KEY:-}"');
    expect(script).toContain("Missing required K1W1_EDGE_WORKFLOW_ADMIN_KEY");
    expect(script).not.toContain('WORKFLOW_ADMIN="${K1W1_EDGE_WORKFLOW_ADMIN_KEY:-${ADMIN_KEY:-${K1W1_EDGE_ADMIN_KEY:-}}}"');
  });

  it("extends workflow edge contract checks to guard ci-lite script fallback drift", () => {
    const checkScript = read("scripts/check_workflow_edge_contracts.sh");
    expect(checkScript).toContain('CI_LITE_ENV_LOAD="scripts/ci-lite-env-load.sh"');
    expect(checkScript).toContain('CI_LITE_SMOKE="scripts/ci-lite-smoke.sh"');
    expect(checkScript).toContain("require_fixed \"$CI_LITE_ENV_LOAD\" 'WORKFLOW_ADMIN=\"${K1W1_EDGE_WORKFLOW_ADMIN_KEY:-}\"'");
    expect(checkScript).toContain("require_fixed \"$CI_LITE_SMOKE\" 'WORKFLOW_ADMIN=\"${K1W1_EDGE_WORKFLOW_ADMIN_KEY:-}\"'");
  });
});
