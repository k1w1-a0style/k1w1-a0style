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
});
