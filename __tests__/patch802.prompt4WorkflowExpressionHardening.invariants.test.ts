import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

const extractRunBlocks = (src: string): string[] => {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes("run: |")) continue;
    const runIndent = lines[i].match(/^(\s*)/)?.[1].length ?? 0;
    const block: string[] = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j];
      if (!line.trim()) {
        block.push(line);
        continue;
      }
      const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
      if (indent <= runIndent) {
        break;
      }
      block.push(line);
    }
    blocks.push(block.join("\n"));
  }

  return blocks;
};

describe("patch802 prompt-4 workflow expression/shell hardening invariants", () => {
  it("keeps raw GitHub expressions out of run shell blocks in scoped workflow/action files", () => {
    const scopedFiles = [
      ".github/workflows/k1w1-triggered-build.yml",
      ".github/workflows/ci-build.yml",
      ".github/workflows/workflow-lint.yml",
      ".github/actions/determine-ref/action.yml",
    ];

    for (const file of scopedFiles) {
      const src = read(file);
      const runBlocks = extractRunBlocks(src);
      expect(runBlocks.length).toBeGreaterThan(0);
      for (const block of runBlocks) {
        expect(block).not.toContain("${{");
      }
    }
  });

  it("keeps determine-ref fail-closed with allowlist and validated output writing", () => {
    const action = read(".github/actions/determine-ref/action.yml");
    expect(action).toContain("INPUT_ALLOWED_REFS_CSV");
    expect(action).toContain("Ref not in allowlist");
    expect(action).toContain("Ref violates safe character policy");
    expect(action).toContain("printf 'checkout_ref=%s\\n' \"$REF\" >> \"$GITHUB_OUTPUT\"");
  });

  it("keeps resolve steps fail-closed before writing env-derived values to GITHUB_OUTPUT", () => {
    const triggered = read(".github/workflows/k1w1-triggered-build.yml");
    expect(triggered).toContain("PROFILE_RAW");
    expect(triggered).toContain("JOB_ID_RAW");
    expect(triggered).toContain("AUTOFIX_RAW");
    expect(triggered).toContain("STRICT_LOCKFILE_RAW");
    expect(triggered).toContain("Invalid profile");
    expect(triggered).toContain("Invalid job_id");
    expect(triggered).toContain("Invalid autofix");
    expect(triggered).toContain("Invalid strict_lockfile");
    expect(triggered).toContain("printf 'profile=%s\\n' \"$PROFILE\"");
    expect(triggered).not.toContain("PROFILE=\"$RAW_PROFILE\"");
    expect(triggered).not.toContain("JOB_ID=\"$RAW_JOB_ID\"");
    expect(triggered).not.toContain("AUTOFIX=\"$RAW_AUTOFIX\"");
    expect(triggered).not.toContain("STRICT_LOCKFILE=\"$RAW_STRICT_LOCKFILE\"");

    for (const file of [".github/workflows/ci-build.yml", ".github/workflows/workflow-lint.yml"]) {
      const src = read(file);
      expect(src).toContain("tr -d '\\r\\n'");
      expect(src).toContain("printf 'ref=%s\\n' \"$REF\" >> \"$GITHUB_OUTPUT\"");
    }

    const lint = read(".github/workflows/workflow-lint.yml");
    expect(lint).toContain("REF_SOURCE=\"github_system\"");
    expect(lint).toContain("REF_SOURCE=\"manual\"");
    expect(lint).toContain("Invalid GitHub system ref");
    expect(lint).toContain("^refs/(heads/");

    const ciBuild = read(".github/workflows/ci-build.yml");
    expect(ciBuild).toContain("Invalid ref (safe policy mismatch).");
    expect(ciBuild).not.toContain("RAW_GITHUB_REF");
  });
});
