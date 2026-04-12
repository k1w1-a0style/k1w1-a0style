import { execFileSync } from "node:child_process";
import path from "node:path";

describe("workflow edge contracts shell guard execution", () => {
  it("passes against the current extracted trigger/check layout", () => {
    const repoRoot = process.cwd();
    const scriptPath = path.join(repoRoot, "scripts", "check_workflow_edge_contracts.sh");

    expect(() => {
      execFileSync("bash", [scriptPath], {
        cwd: repoRoot,
        stdio: "pipe",
        encoding: "utf8",
      });
    }).not.toThrow();
  });
});

