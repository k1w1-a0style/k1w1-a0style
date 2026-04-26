import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("release:ready contracts", () => {
  it("wires package.json release:ready to central script", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.["release:ready"]).toBe("bash scripts/release_ready.sh");
  });

  it("aggregates required release gates and ampel output contract", () => {
    const script = read("scripts/release_ready.sh");

    expect(script).toContain('run_check "Node/npm version" required');
    expect(script).toContain('run_check "npm lockfile consistency" required');
    expect(script).toContain('run_check "TypeScript App" required');
    expect(script).toContain('run_check "TypeScript Edge Functions" required');
    expect(script).toContain('run_check "Lint" required');
    expect(script).toContain('run_check "Tests" required');
    expect(script).toContain('run_check "verify:release" required');
    expect(script).toContain('run_check "Preview Production ENV Defaults" required');
    expect(script).toContain('run_check "Android Backup Status" required');
    expect(script).toContain('run_check "GitHub Actions permission sanity checks" required');
    expect(script).toContain('run_check "Supabase function config sanity checks" required');
    expect(script).toContain('Optionale Live-Checks');
    expect(script).toContain('Check | Status | Hinweis');
    expect(script).toContain('🔴 ROT');
    expect(script).toContain('🟡 GELB');
    expect(script).toContain('🟢 GRÜN');
  });
});
