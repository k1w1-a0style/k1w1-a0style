import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("release readiness contract", () => {
  it("keeps critical workflow/edge/doc guard checks wired in release script", () => {
    const script = read("scripts/check_release_readiness.sh");

    expect(script).toContain("bash scripts/check_patch_docs_sync.sh");
    expect(script).toContain("bash scripts/check_workflow_template_drift.sh");
    expect(script).toContain("bash scripts/check_managed_workflows.sh");
    expect(script).toContain("bash scripts/check_supabase_deploy_workflow.sh");
    expect(script).toContain("bash scripts/check_eas_manual_trigger_controls.sh");
    expect(script).toContain("bash scripts/check_eas_strict_lockfile_policy.sh");
    expect(script).toContain("bash scripts/check_workflow_edge_contracts.sh");
    expect(script).toContain("bash scripts/check_edge_rate_limit_retention.sh");
    expect(script).toContain("bash scripts/check_legacy_disabled_edges.sh");
    expect(script).toContain("bash scripts/check_edge_helper_visibility.sh");
    expect(script).toContain("bash scripts/check_supabase_rls_hardening.sh");
    expect(script).toContain("bash scripts/check_edge_live_env_readiness.sh");
  });

  it("keeps live-edge checks explicitly optional (env-gated)", () => {
    const script = read("scripts/check_release_readiness.sh");

    expect(script).toContain('if [[ -n "${EDGE_BASE_URL:-}" && -n "${EDGE_OPERATOR_JWT:-}" ]]; then');
    expect(script).toContain("bash scripts/check_edge_live_contracts.sh");
    expect(script).toContain("skip live edge contracts");

    const readinessScript = read("scripts/check_edge_live_env_readiness.sh");
    expect(readinessScript).toContain("Live-edge env readiness: SKIP");
  });

  it("distinguishes full-green from env-skipped release runs in script output contract", () => {
    const script = read("scripts/check_release_readiness.sh");

    expect(script).toContain("[verify:release] OK_WITH_SKIPS");
    expect(script).toContain("partial/local evidence only, not full release sign-off");
    expect(script).toContain("[verify:release] OK_FULL");
    expect(script).toContain("SKIP_COUNT=$((SKIP_COUNT + 1))");
  });
});
