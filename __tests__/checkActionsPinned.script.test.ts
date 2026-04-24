import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

function runCheckInTemp({
  workflowContent = "",
  actionYmlContent = "",
  actionYamlContent = "",
}: {
  workflowContent?: string;
  actionYmlContent?: string;
  actionYamlContent?: string;
}): { status: number | null; stdout: string; stderr: string } {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "check-actions-pinned-"));
  const workflowsDir = path.join(tmpRoot, ".github", "workflows");
  const actionsDir = path.join(tmpRoot, ".github", "actions", "local");
  fs.mkdirSync(workflowsDir, { recursive: true });
  fs.mkdirSync(actionsDir, { recursive: true });

  if (workflowContent) {
    fs.writeFileSync(path.join(workflowsDir, "test.yml"), workflowContent, "utf8");
  }
  if (actionYmlContent) {
    fs.writeFileSync(path.join(actionsDir, "action.yml"), actionYmlContent, "utf8");
  }
  if (actionYamlContent) {
    fs.writeFileSync(path.join(actionsDir, "nested.yaml"), actionYamlContent, "utf8");
  }

  const scriptPath = path.join(process.cwd(), ".github", "scripts", "check-actions-pinned.mjs");
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: tmpRoot,
    encoding: "utf8",
  });

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

describe("check-actions-pinned script", () => {
  it("fails for list-style non-SHA action refs", () => {
    const result = runCheckInTemp({
      workflowContent: `
name: test
jobs:
  t:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
`,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("not pinned to 40-char SHA");
  });

  it("accepts pinned refs while ignoring local and docker actions", () => {
    const result = runCheckInTemp({
      workflowContent: `
name: test
jobs:
  t:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd
      - uses: "./.github/actions/local-action"
      - uses: docker://alpine:3.20
`,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("OK: all remote actions are pinned to full SHAs.");
  });

  it("scans local action definitions under .github/actions for both .yml and .yaml", () => {
    const result = runCheckInTemp({
      actionYmlContent: `
name: local
runs:
  using: composite
  steps:
    - uses: actions/setup-node@v4
`,
      actionYamlContent: `
name: nested
runs:
  using: composite
  steps:
    - uses: actions/checkout@v5
`,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(".github/actions/local/action.yml");
    expect(result.stderr).toContain(".github/actions/local/nested.yaml");
    expect(result.stderr).toContain("not pinned to 40-char SHA");
  });
});
