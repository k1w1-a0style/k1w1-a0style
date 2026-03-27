import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("patch549 keystore export JWT/RBAC hardening invariants", () => {
  it("enables verify_jwt for android-keystore-export", () => {
    const rootConfig = read("supabase/config.toml");
    expect(rootConfig).toContain("[functions.android-keystore-export]");
    expect(rootConfig).toContain("verify_jwt = true");

    const functionConfig = read("supabase/functions/android-keystore-export/config.toml");
    expect(functionConfig).toContain("verify_jwt = true");
  });

  it("keeps deny-by-default JWT role checks in shared auth and the route entrypoint", () => {
    const sharedAuth = read("supabase/functions/_shared/auth.ts");
    expect(sharedAuth).toContain("export type JwtRoleGuardConfig = {");
    expect(sharedAuth).toContain("export function requireJwtRole(req: Request, cfg: JwtRoleGuardConfig): Response | null {");
    expect(sharedAuth).toContain("Forbidden: JWT role is not allowed for this route.");

    const route = read("supabase/functions/android-keystore-export/index.ts");
    expect(route).toContain("const jwtRoleGuard = requireJwtRole(req, {");
    expect(route).toContain('allowedRoles: ["service_role"]');
  });
});
