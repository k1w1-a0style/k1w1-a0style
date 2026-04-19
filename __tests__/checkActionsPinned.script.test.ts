import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

function runCheckInTemp(workflowContent: string): { status: number | null; stdout: string; stderr: string } {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "check-actions-pinned-"));
  const workflowsDir = path.join(tmpRoot, ".github", "workflows");
  fs.mkdirSync(workflowsDir, { recursive: true });
  fs.writeFileSync(path.join(workflowsDir, "test.yml"), workflowContent, "utf8");

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
    const result = runCheckInTemp(`
name: test
jobs:
  t:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
`);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("not pinned to 40-char SHA");
  });

  it("accepts pinned refs while ignoring local and docker actions", () => {
    const result = runCheckInTemp(`
name: test
jobs:
  t:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd
      - uses: "./.github/actions/local-action"
      - uses: docker://alpine:3.20
`);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("OK: all remote actions are pinned to full SHAs.");
  });
});
