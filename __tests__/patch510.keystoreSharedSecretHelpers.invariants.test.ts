import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("patch510 keystore shared secret helper invariants", () => {
  const sharedAuth = "supabase/functions/_shared/auth.ts";
  const authRuntime = "supabase/functions/_shared/auth/runtime.ts";
  const authAdmin = "supabase/functions/_shared/auth/admin.ts";
  const generateHelpers = "supabase/functions/android-keystore-generate/helpers.ts";
  const exportHelpers = "supabase/functions/android-keystore-export/helpers.ts";
  const statusHelpers = "supabase/functions/android-keystore-status/helpers.ts";
  const generateIndex = "supabase/functions/android-keystore-generate/index.ts";
  const exportIndex = "supabase/functions/android-keystore-export/index.ts";
  const statusIndex = "supabase/functions/android-keystore-status/index.ts";

  it("exposes shared runtime secret helpers from _shared/auth", () => {
    const src = read(sharedAuth);
    const runtime = read(authRuntime);
    const admin = read(authAdmin);
    expect(src).toContain("getSupabaseUrl");
    expect(admin).toContain("export function getSupabaseUrl(): string | null {");
    expect(runtime).toContain("export const getSupabaseUrlSecret = (): string | null =>");
    expect(runtime).toContain('getRuntimeEnv("K1W1_SUPABASE_URL")');
    expect(runtime).toContain('getRuntimeEnv("SUPABASE_URL")');
    expect(admin).toContain("export function getSigningMasterKey(): string | null {");
    expect(runtime).toContain("export const getSigningMasterKeySecret = (): string | null =>");
    expect(runtime).toContain('getRuntimeEnv("SIGNING_MASTER_KEY")');
  });

  it("re-exports the shared secret helpers for keystore generate/export/status paths", () => {
    expect(read(generateHelpers)).toContain("requireScopedEdgeAuth");
    expect(read(generateHelpers)).toContain("requirePrivilegedOperatorJwtRole");
    expect(read(generateHelpers)).toContain("requireDurableRateLimit,");
    expect(read(exportHelpers)).toContain("getSigningMasterKey");
    expect(read(exportHelpers)).toContain("getSupabaseUrl");
    expect(read(statusHelpers)).toContain("requireScopedEdgeAuth");
    expect(read(statusHelpers)).toContain("requirePrivilegedOperatorJwtRole");
  });

  it("removes parallel direct Deno.env secret reads from keystore generate/export/status indexes", () => {
    for (const rel of [generateIndex, exportIndex, statusIndex]) {
      const src = read(rel);
      expect(src).not.toContain('Deno.env.get("SUPABASE_URL")');
      expect(src).not.toContain('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")');
      expect(src).not.toContain('Deno.env.get("SIGNING_MASTER_KEY")');
    }

    expect(read(generateIndex)).toContain("const supabaseUrl = getSupabaseUrl();");
    expect(read(generateIndex)).toContain("const masterKey = getSigningMasterKey();");
    expect(read(exportIndex)).toContain("const supabaseUrl = getSupabaseUrl();");
    expect(read(exportIndex)).toContain("const masterKey = getSigningMasterKey();");
    expect(read(statusIndex)).toContain("const supabaseUrl = getSupabaseUrl();");
  });

  it("keeps keystore auth contracts on scoped admin secret + privileged JWT roles", () => {
    expect(read(exportIndex)).toContain("requireScopedEdgeAuth(req, {");
    expect(read(exportIndex)).toContain('adminSecretEnv: "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY"');
        expect(read(exportIndex)).toContain("requireJwtRole(req, {");
    expect(read(exportIndex)).toContain('allowedRoles: ["service_role"]');
    expect(read(statusIndex)).toContain("requireScopedEdgeAuth(req, {");
    expect(read(generateIndex)).toContain("requireScopedEdgeAuth(req, {");
    expect(read(statusIndex)).toContain('requirePrivilegedOperatorJwtRole(req, "android-keystore-status")');
    expect(read(generateIndex)).toContain('requirePrivilegedOperatorJwtRole(req, "android-keystore-generate")');
    expect(read(statusIndex)).not.toContain("requireAdminKey(req)");
    expect(read(generateIndex)).not.toContain("requireAdminKey(req)");
  });
});
