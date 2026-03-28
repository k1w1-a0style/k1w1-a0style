import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const SOURCE_GLOBS = ["contexts", "hooks", "infra", "lib", "screens", "supabase", "scripts", "__tests__"] as const;

const ALLOWED_GENERIC_HELPER_USAGE = new Set([
  "infra/github/tokenStore.ts",
  "__tests__/tokenStore.edgeAdminKey.test.ts",
]);

const collectFiles = (dirRel: string, acc: string[] = []): string[] => {
  const abs = path.join(ROOT, dirRel);
  if (!fs.existsSync(abs)) return acc;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dirRel, entry.name);
    if (entry.isDirectory()) {
      collectFiles(rel, acc);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx|sh)$/.test(entry.name)) continue;
    acc.push(rel.replace(/\\/g, "/"));
  }
  return acc;
};

describe("legacy edge admin compat boundaries", () => {
  it("keeps generic edge admin helper names contained to explicit compat files", () => {
    const files = SOURCE_GLOBS.flatMap((dir) => collectFiles(dir));

    const offenders: string[] = [];
    for (const rel of files) {
      if (ALLOWED_GENERIC_HELPER_USAGE.has(rel)) continue;
      const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
      if (/\b(get|save|delete)EdgeAdminKey\b/.test(src)) {
        offenders.push(rel);
      }
    }

    expect(offenders).toEqual([]);
  });
});
