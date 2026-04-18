import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

const legacy = [
  "trigger-lint",
  "check-lint",
  "trigger-native-sync",
  "check-native-sync",
  "native-sync-report",
  "native-sync-report-ingest",
] as const;

describe("patch416 legacy edge disablement invariants", () => {
  test("legacy 410-returning edge functions are removed from supabase config", () => {
    const cfg = read("supabase/config.toml");
    legacy.forEach((fn) => expect(cfg).not.toContain(`[functions.${fn}]`));
  });

  test("legacy edge implementation directories are removed", () => {
    legacy.forEach((fn) => {
      const rel = path.join(root, "supabase/functions", fn);
      expect(fs.existsSync(rel)).toBe(false);
    });
  });

  test("workflow lint runs the legacy disabled-edge guard", () => {
    const wf = read(".github/workflows/workflow-lint.yml");
    expect(wf).toContain("bash scripts/check_legacy_disabled_edges.sh");
  });
});
