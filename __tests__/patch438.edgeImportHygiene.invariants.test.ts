import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "..");
const functionsRoot = path.join(root, "supabase/functions");

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(full));
      continue;
    }
    if (entry.isFile() && full.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("patch438 edge import hygiene invariants", () => {
  test("supabase edge functions do not import GitHub API base from app shared constants", () => {
    const offenders = walkTsFiles(functionsRoot)
      .filter((file) => fs.readFileSync(file, "utf8").includes('../../../shared/constants/github.ts'))
      .map((file) => path.relative(root, file));

    expect(offenders).toEqual([]);
  });

  test("edge shared github helper owns the GitHub API base constant", () => {
    const src = fs.readFileSync(path.join(root, "supabase/functions/_shared/github.ts"), "utf8");
    expect(src).toContain('export const GITHUB_API_BASE = "https://api.github.com";');
  });
});
