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

function expectDisabledInConfig(src: string, fn: string) {
  const escaped = fn.replace(/[-/]/g, "\\$&");
  const re = new RegExp(`\\[functions\\.${escaped}\\][\\s\\S]{0,120}?enabled = false`);
  expect(src).toMatch(re);
}

describe("patch416 legacy edge disablement invariants", () => {
  test("legacy 410-returning edge functions are disabled in supabase config", () => {
    const cfg = read("supabase/config.toml");
    legacy.forEach((fn) => expectDisabledInConfig(cfg, fn));
  });

  test("legacy edge implementations still advertise disabled 410 responses", () => {
    legacy.forEach((fn) => {
      const src = read(`supabase/functions/${fn}/index.ts`);
      expect(src).toContain("disabled: true");
      expect(src).toContain("return jsonResponse(");
      expect(src).toContain("req,");
      expect(src).toContain("410,");
    });
  });

  test("workflow lint runs the legacy disabled-edge guard", () => {
    const wf = read(".github/workflows/workflow-lint.yml");
    expect(wf).toContain("bash scripts/check_legacy_disabled_edges.sh");
  });
});
