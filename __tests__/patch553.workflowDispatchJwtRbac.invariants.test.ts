import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("patch553 github-workflow-dispatch JWT/RBAC hardening invariants", () => {
  it("enables verify_jwt for github-workflow-dispatch", () => {
    const rootConfig = read("supabase/config.toml");
    expect(rootConfig).toContain("[functions.github-workflow-dispatch]");
    expect(rootConfig).toContain("verify_jwt = true");
  });

  it("requires scoped workflow admin key + JWT claim role checks for dispatch", () => {
    const route = read("supabase/functions/github-workflow-dispatch/index.ts");
    expect(route).toContain("requireScopedEdgeAuth(req, {");
    expect(route).toContain("allowCiBearer: false");
    expect(route).toContain("allowJwtAuthHeaderWithAdmin: true");
    expect(route).toContain('adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY"');
    expect(route).toContain("const jwtRoleGuard = requireJwtRole(req, {");
    expect(route).toContain('allowedRoles: ["service_role", "authenticated"]');
  });

  it("hardens workflow runs/logs routes to the same JWT + scoped-admin contract", () => {
    const rootConfig = read("supabase/config.toml");
    expect(rootConfig).toContain("[functions.github-workflow-runs]");
    expect(rootConfig).toContain("[functions.github-workflow-logs]");
    expect(rootConfig).toContain("verify_jwt = true");

    const runs = read("supabase/functions/github-workflow-runs/index.ts");
    expect(runs).toContain("allowCiBearer: false");
    expect(runs).toContain("allowJwtAuthHeaderWithAdmin: true");
    expect(runs).toContain('adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY"');
    expect(runs).toContain("const jwtRoleGuard = requireJwtRole(req, {");
    expect(runs).toContain('allowedRoles: ["service_role", "authenticated"]');

    const logs = read("supabase/functions/github-workflow-logs/index.ts");
    expect(logs).toContain("allowCiBearer: false");
    expect(logs).toContain("allowJwtAuthHeaderWithAdmin: true");
    expect(logs).toContain('adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY"');
    expect(logs).toContain("const jwtRoleGuard = requireJwtRole(req, {");
    expect(logs).toContain('allowedRoles: ["service_role", "authenticated"]');
  });
});
