import fs from "fs";

const read = (p: string) => fs.readFileSync(p, "utf8");

describe("patch 403 workflow contract invariants", () => {
  it("keeps CI Lite package-manager aware in live workflows", () => {
    const ci = read(".github/workflows/k1w1-ci-lite.yml");
    const autofix = read(".github/workflows/k1w1-ci-lite-autofix.yml");

    for (const src of [ci, autofix]) {
      expect(src).toContain("package_manager");
      expect(src).toContain("cache_kind");
      expect(src).toContain("yarn install --immutable");
      expect(src).toContain("pnpm install --frozen-lockfile");
    }
  });

  it("keeps CI Lite package-manager aware in infra + edge bootstrap templates", () => {
    const infra = read("infra/github/workflowTemplates.ts");
    const edge = read("supabase/functions/github-workflow-dispatch/index.ts");

    for (const src of [infra, edge]) {
      expect(src).toContain("package_manager");
      expect(src).toContain("cache_kind");
      expect(src).toContain("yarn install --immutable");
      expect(src).toContain("pnpm install --frozen-lockfile");
      expect(src).toContain("repository_dispatch:");
      expect(src).toContain("source_sha");
    }
  });

  it("keeps EAS autofix honest for non-npm repos", () => {
    const src = read(".github/workflows/eas-build.yml");
    const diag = read("lib/diagnostics/workflowTemplates.ts");

    for (const body of [src, diag]) {
      expect(body).toContain("Auto-fix writeback currently supports npm-managed repos only");
      expect(body).toContain("PACKAGE_MANAGER");
      expect(body).toContain("HAS_LOCKFILE");
      expect(body).toContain("LOCKFILE_PATH");
    }
  });

  it("keeps triggered build flags for repository_dispatch", () => {
    const src = read(".github/workflows/k1w1-triggered-build.yml");
    expect(src).toContain("github.event.client_payload.autofix");
    expect(src).toContain("github.event.client_payload.strict_lockfile");
  });

  it("keeps target-ref concurrency for Supabase deploy", () => {
    const src = read(".github/workflows/deploy-supabase-functions.yml");
    expect(src).toContain("${{ github.workflow }}-${{ inputs.ref }}");
  });
});
