import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("patch510 keystore shared secret helper invariants", () => {
  const sharedAuth = "supabase/functions/_shared/auth.ts";
  const generateHelpers = "supabase/functions/android-keystore-generate/helpers.ts";
  const exportHelpers = "supabase/functions/android-keystore-export/helpers.ts";
  const statusHelpers = "supabase/functions/android-keystore-status/helpers.ts";
  const generateIndex = "supabase/functions/android-keystore-generate/index.ts";
  const exportIndex = "supabase/functions/android-keystore-export/index.ts";
  const statusIndex = "supabase/functions/android-keystore-status/index.ts";

  it("exposes shared runtime secret helpers from _shared/auth", () => {
    const src = read(sharedAuth);
    expect(src).toContain("export function getSupabaseUrl(): string | null {");
    expect(src).toContain("const getSupabaseUrlSecret = (): string | null =>");
    expect(src).toContain('getRuntimeEnv("K1W1_SUPABASE_URL")');
    expect(src).toContain('getRuntimeEnv("SUPABASE_URL")');
    expect(src).toContain("export function getSigningMasterKey(): string | null {");
    expect(src).toContain("const getSigningMasterKeySecret = (): string | null =>");
    expect(src).toContain('getRuntimeEnv("SIGNING_MASTER_KEY")');
  });

  it("re-exports the shared secret helpers for keystore generate/export/status paths", () => {
    expect(read(generateHelpers)).toContain('export { getServiceRoleKey, getSigningMasterKey, getSupabaseUrl, rateLimit, requireAdminKey } from "../_shared/auth.ts";');
    expect(read(generateHelpers)).toContain('export { requireDurableRateLimit } from "../_shared/auth.ts";');
    expect(read(exportHelpers)).toContain("getSigningMasterKey");
    expect(read(exportHelpers)).toContain("getSupabaseUrl");
    expect(read(statusHelpers)).toContain('export { rateLimit, requireAdminKey, getServiceRoleKey, getSupabaseUrl } from "../_shared/auth.ts";');
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

  it("keeps auth guard contracts unchanged while aligning shared secret helpers", () => {
    expect(read(exportIndex)).toContain("requireScopedEdgeAuth(req, {");
    expect(read(exportIndex)).toContain('adminSecretEnv: "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY"');
    expect(read(exportIndex)).toContain("allowCiBearer: false");
    expect(read(exportIndex)).toContain("requireJwtRole(req, {");
    expect(read(exportIndex)).toContain('allowedRoles: ["service_role"]');
    expect(read(statusIndex)).toContain("requireAdminKey(req)");
    expect(read(generateIndex)).toContain("requireAdminKey(req)");
  });
});
