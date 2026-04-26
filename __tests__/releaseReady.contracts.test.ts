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
  it("treats executed optional live-check failures as FAIL/ROT (not SKIP)", () => {
    const script = read("scripts/release_ready.sh");

    expect(script).not.toContain('status="SKIP"');
    expect(script).not.toContain('optional check failed/skipped');
    expect(script).toContain('if [[ $exit_code -ne 0 ]]; then');
    expect(script).toContain('status="FAIL"');
    expect(script).toContain('REQUIRED_FAIL=1');
    expect(script).toContain('run_check "Optionale Live-Checks" optional');
    expect(script).toContain('CHECK_STATUS+=("SKIP")');
    expect(script).toContain('EDGE_BASE_URL und/oder EDGE_OPERATOR_JWT');
    expect(script).toContain('🔴 ROT: Mindestens ein Pflichtcheck ist fehlgeschlagen.');
  });

});
