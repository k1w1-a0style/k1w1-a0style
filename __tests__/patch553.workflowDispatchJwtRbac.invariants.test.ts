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
    expect(route).toContain('allowedRoles: ["service_role", "authenticated", "anon"]');
  });
});
