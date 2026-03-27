import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("patch415 edge auth guard invariants", () => {
  const sharedAuth = "supabase/functions/_shared/auth.ts";
  const workflowScoped = [
    "supabase/functions/trigger-eas-build/index.ts",
    "supabase/functions/check-eas-build/index.ts",
    "supabase/functions/github-workflow-runs/index.ts",
    "supabase/functions/github-workflow-logs/index.ts",
    "supabase/functions/github-run-artifact-json/index.ts",
  ];
  const adminOnly = [
    "supabase/functions/android-keystore-generate/index.ts",
    "supabase/functions/android-keystore-status/index.ts",
  ];

  it("defines the scoped edge auth guard and fails closed without configured route secrets", () => {
    const src = read(sharedAuth);
    expect(src).toContain("export type ScopedEdgeAuthConfig = {");
    expect(src).toContain("export function requireScopedEdgeAuth(req: Request, cfg: ScopedEdgeAuthConfig): Response | null {");
    expect(src).toContain('"Missing required auth secrets for this Edge Function."');
    expect(src).toContain('"Unauthorized: send either admin key OR bearer token, not both."');
    expect(src).toContain('"Unauthorized: missing authentication header."');
    expect(src).toContain('accepted.push("x-k1w1-admin-key")');
  });

  it("moves workflow-facing edge functions onto scoped workflow admin/bearer secrets", () => {
    for (const rel of workflowScoped) {
      const src = read(rel);
      expect(src).toContain("requireScopedEdgeAuth");
      expect(src).toContain('adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY"');
      if (
        rel.includes("trigger-eas-build") ||
        rel.includes("check-eas-build") ||
        rel.includes("github-workflow-runs") ||
        rel.includes("github-workflow-logs")
      ) {
        expect(src).toContain("allowCiBearer: false");
        expect(src).toContain("allowJwtAuthHeaderWithAdmin: true");
        expect(src).toContain("requireJwtRole(req, {");
        expect(src).toContain('allowedRoles: ["service_role", "authenticated"]');
        expect(src).not.toContain('ciBearerSecretEnv: "K1W1_EDGE_WORKFLOW_CI_BEARER"');
      } else {
        expect(src).toContain('ciBearerSecretEnv: "K1W1_EDGE_WORKFLOW_CI_BEARER"');
      }
      expect(src).not.toContain("const auth = requireAdminKey(req);");
      expect(src).not.toContain("const authError = requireAdminKey(req);");
    }
  });

  it("keeps github-workflow-dispatch on scoped workflow admin key + JWT role checks", () => {
    const src = read("supabase/functions/github-workflow-dispatch/index.ts");
    expect(src).toContain("requireScopedEdgeAuth");
    expect(src).toContain('adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY"');
    expect(src).toContain("allowCiBearer: false");
    expect(src).toContain("allowJwtAuthHeaderWithAdmin: true");
    expect(src).toContain("const jwtRoleGuard = requireJwtRole(req, {");
    expect(src).toContain('allowedRoles: ["service_role", "authenticated"]');
    expect(src).not.toContain('ciBearerSecretEnv: "K1W1_EDGE_WORKFLOW_CI_BEARER"');
  });

  it("keeps android-keystore-export on a scoped admin-only route secret", () => {
    const src = read("supabase/functions/android-keystore-export/index.ts");
    expect(src).toContain("requireScopedEdgeAuth(req, {");
    expect(src).toContain("allowCiBearer: false");
    expect(src).toContain('adminSecretEnv: "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY"');
    expect(src).toContain("requireJwtRole(req, {");
    expect(src).toContain('allowedRoles: ["service_role"]');
    expect(src).not.toContain("requireAdminKeyOrServiceRoleBearer");
  });

  it("keeps android-keystore-generate on the shared server-side service-role lookup", () => {
    const src = read("supabase/functions/android-keystore-generate/index.ts");
    const helpers = read("supabase/functions/android-keystore-generate/helpers.ts");
    expect(helpers).toContain('export { getServiceRoleKey, getSigningMasterKey, getSupabaseUrl, rateLimit, requireAdminKey } from "../_shared/auth.ts";');
    expect(src).toContain("const serviceKey = getServiceRoleKey(req);");
    expect(src).toContain("const supabaseUrl = getSupabaseUrl();");
    expect(src).toContain("const masterKey = getSigningMasterKey();");
    expect(src).not.toContain('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")');
    expect(src).not.toContain('Deno.env.get("SUPABASE_URL")');
    expect(src).not.toContain('Deno.env.get("SIGNING_MASTER_KEY")');
  });

  it("keeps wizard-style keystore routes admin-only", () => {
    for (const rel of adminOnly) {
      const src = read(rel);
      expect(src).toContain("requireAdminKey(req)");
      expect(src).not.toContain("requireAdminKeyOrServiceRoleBearer");
    }
  });

  it("documents workflow and keystore routes with their scoped secrets", () => {
    const edgeStatus = read("docs/EDGE_FUNCTIONS_STATUS.md");
    expect(edgeStatus).toContain("K1W1_EDGE_WORKFLOW_ADMIN_KEY");
    expect(edgeStatus).toContain("K1W1_EDGE_WORKFLOW_CI_BEARER");
    expect(edgeStatus).toContain("K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY");
    expect(edgeStatus).toContain("`github-workflow-dispatch`");
    expect(edgeStatus).toContain("`android-keystore-export`");
  });
});
