import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("patch603 legacy test route auth contract", () => {
  it("keeps supabase/functions/test fail-closed on scoped legacy admin auth", () => {
    const route = read("supabase/functions/test/index.ts");

    expect(route).toContain("requireScopedEdgeAuth(req, {");
    expect(route).toContain('scope: "test"');
    expect(route).toContain('adminSecretEnv: "K1W1_EDGE_ADMIN_KEY"');
    expect(route).toContain("allowAdmin: true");
    expect(route).toContain("status: 410");
    expect(route).toContain("legacy_test_route_disabled");
    expect(route).not.toContain("requireAdminKey(req)");
    expect(route).not.toContain("ok: true");
  });

  it("hardens workflow edge contract check against missing allowAdmin/scope on legacy test route", () => {
    const check = read("scripts/check_workflow_edge_contracts.sh");

    expect(check).toContain('require_fixed "$LEGACY_TEST_EDGE" \'scope: "test"\'');
    expect(check).toContain('require_fixed "$LEGACY_TEST_EDGE" \'allowAdmin: true\'');
    expect(check).toContain('require_fixed "$LEGACY_TEST_EDGE" \'status: 410\'');
    expect(check).toContain('require_fixed "$LEGACY_TEST_EDGE" \'legacy_test_route_disabled\'');
  });
});


describe("deploy workflow legacy test exclusion contract", () => {
  it("keeps the legacy test function out of deploy-all and single deploy paths", () => {
    const workflow = read(".github/workflows/deploy-supabase-functions.yml");

    expect(workflow).toContain('[ "$name" != "_shared" ] && [ "$name" != "test" ]');
    expect(workflow).toContain('Refusing to deploy legacy disabled function: test');
  });
});
