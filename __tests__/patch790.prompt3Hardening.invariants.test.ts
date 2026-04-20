import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

describe("patch790 prompt-3 hardening invariants", () => {
  it("removes external regex execution from determine-ref and enforces allowlist input", () => {
    const action = read(".github/actions/determine-ref/action.yml");
    expect(action).toContain("allowed_refs_csv");
    expect(action).not.toContain("allowed_ref_regex");
    expect(action).not.toContain('[[ "$REF" =~ $ALLOWED ]]');
    expect(action).toContain('[[ "$REF" == *//* ]]');
    expect(action).toContain("Ref not in allowlist");
  });

  it("keeps CI Lite workflows on safe run names and sanitized env export", () => {
    const ciLite = read(".github/workflows/k1w1-ci-lite.yml");
    const autofix = read(".github/workflows/k1w1-ci-lite-autofix.yml");

    for (const src of [ciLite, autofix]) {
      expect(src).toContain("run-${{ github.run_id }}-${{ github.run_attempt }}");
      expect(src).toContain("allowed_refs_csv: work,codex,dev,develop");
      expect(src).toContain("printf 'JOB_ID=%s\\n'");
      expect(src).not.toContain("echo \"JOB_ID=${{ ");
    }
  });

  it("keeps workflow dispatch path fail-closed to an allowlisted workflow set", () => {
    const dispatch = read("supabase/functions/github-workflow-dispatch/index.ts");
    expect(dispatch).toContain("const ALLOWED_WORKFLOW_FILES = new Set<string>([");
    expect(dispatch).toContain("if (!ALLOWED_WORKFLOW_FILES.has(normalized))");
    expect(dispatch).toContain("Workflow alias/file is not allowlisted for dispatch.");
  });
});
