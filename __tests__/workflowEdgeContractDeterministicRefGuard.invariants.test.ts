import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("workflow edge contract guard aligns with deterministic trigger ref contract", () => {
  it("checks resolveDispatchRef contract instead of obsolete literal ref: branch", () => {
    const script = read("scripts/check_workflow_edge_contracts.sh");
    expect(script).toContain(`require_fixed "$TRIGGER_EDGE" 'resolveDispatchRef'`);
    expect(script).toContain(`require_fixed "$TRIGGER_EDGE" 'ref: resolveDispatchRef(branch, sourceCommitSha)'`);
    expect(script).toContain(`require_fixed "$TRIGGER_EDGE" 'source_commit_sha: sourceCommitSha'`);
    expect(script).not.toContain(`require_fixed "$TRIGGER_EDGE" 'ref: branch'`);
  });
});
