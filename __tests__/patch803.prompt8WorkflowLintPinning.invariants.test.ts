import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("patch803 prompt-8 workflow lint and action pinning invariants", () => {
  it("keeps workflow-lint free of remote script piping installs", () => {
    const lintWorkflow = read(".github/workflows/workflow-lint.yml");
    expect(lintWorkflow).not.toMatch(/curl[^\n]*\|\s*(?:bash|sh)\b/i);
    expect(lintWorkflow).not.toMatch(/wget[^\n]*\|\s*(?:bash|sh)\b/i);
    expect(lintWorkflow).toContain("sha256sum --check -");
    expect(lintWorkflow).toContain("install -m 0755 actionlint /usr/local/bin/actionlint");
  });

  it("keeps action pinning guard coverage for workflows and local action YAML files", () => {
    const pinningGuard = read(".github/scripts/check-actions-pinned.mjs");
    expect(pinningGuard).toContain('path.join(process.cwd(), ".github", "workflows")');
    expect(pinningGuard).toContain('path.join(process.cwd(), ".github", "actions")');
    expect(pinningGuard).toContain('entry.name.endsWith(".yml")');
    expect(pinningGuard).toContain('entry.name.endsWith(".yaml")');
  });
});
