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
    expect(auth).toContain("export function getServiceRoleKey(_req: Request)");
    expect(auth).toContain('Deno.env.get("K1W1_SUPABASE_SERVICE_ROLE_KEY")');
    expect(auth).not.toContain("return getBearerToken(req) || Deno.env.get(\"SUPABASE_SERVICE_ROLE_KEY\") || null;");
  });

  it("android-keystore-export gates admin and CI paths separately", () => {
    const src = fs.readFileSync(exportPath, "utf8");
    expect(src).toContain("hasAdminKeySecretConfigured()");
    expect(src).toContain("hasServiceRoleSecretConfigured()");
    expect(src).toContain("requireAdminKey(req)");
    expect(src).toContain("requireServiceRoleBearer(req)");
    expect(src).toContain("Unauthorized: missing or invalid admin key / CI bearer token.");
  });
});
