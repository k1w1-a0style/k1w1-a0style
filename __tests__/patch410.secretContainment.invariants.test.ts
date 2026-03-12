import fs from "fs";
import path from "path";

describe("patch410 secret containment invariants", () => {
  const authPath = path.join(process.cwd(), "supabase/functions/_shared/auth.ts");
  const exportPath = path.join(
    process.cwd(),
    "supabase/functions/android-keystore-export/index.ts",
  );

  it("keeps server-side service role lookup separate from caller bearer auth", () => {
    const auth = fs.readFileSync(authPath, "utf8");
    expect(auth).toContain("export function requireServiceRoleBearer(req: Request)");
    expect(auth).toContain("export function requireAdminKeyOrServiceRoleBearer(req: Request)");
    expect(auth).toContain("if (!hasAdmin && !hasCi) {");
    expect(auth).toContain('"Missing auth configuration for this Edge Function."');
    expect(auth).toContain("export function getServiceRoleKey(_req: Request)");
    expect(auth).toContain('Deno.env.get("K1W1_SUPABASE_SERVICE_ROLE_KEY")');
    expect(auth).not.toContain(`return getBearerToken(req) || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || null;`);
  });

  it("android-keystore-export reuses the shared admin/CI auth gate", () => {
    const src = fs.readFileSync(exportPath, "utf8");
    expect(src).toContain("requireAdminKeyOrServiceRoleBearer(req)");
    expect(src).not.toContain("hasAdminKeySecretConfigured()");
    expect(src).not.toContain("requireServiceRoleBearer(req)");
  });
});
