import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("patch549 keystore export JWT/RBAC hardening invariants", () => {
  it("enables verify_jwt for android-keystore-export", () => {
    const rootConfig = read("supabase/config.toml");
    expect(rootConfig).toContain("[functions.android-keystore-export]");
    expect(rootConfig).toMatch(/\[functions\.android-keystore-export\][\s\S]*?verify_jwt\s*=\s*true/);
    expect(fs.existsSync(path.join(process.cwd(), "supabase/functions/android-keystore-export/config.toml"))).toBe(false);
  });

  it("keeps deny-by-default JWT role checks in shared auth and the route entrypoint", () => {
    const sharedAuth = read("supabase/functions/_shared/auth.ts");
    const jwt = read("supabase/functions/_shared/auth/jwt.ts");
    expect(sharedAuth).toContain('export type { JwtPayload, JwtRoleGuardConfig } from "./auth/jwt.ts";');
    expect(sharedAuth).toContain('requireJwtRole');
    expect(jwt).toContain("export type JwtRoleGuardConfig = {");
    expect(jwt).toContain("export async function requireJwtRole(req: Request, cfg: JwtRoleGuardConfig): Promise<Response | null> {");
    expect(jwt).toContain("Forbidden: verified JWT role is not allowed for this route.");

    const route = read("supabase/functions/android-keystore-export/index.ts");
    expect(route).toContain("const jwtRoleGuard = await requireJwtRole(req, {");
    expect(route).toContain('allowedRoles: ["service_role"]');
    expect(route).toContain("allowJwtAuthHeaderWithAdmin: true");
  });
});
