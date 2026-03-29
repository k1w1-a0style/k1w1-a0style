import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("patch415 edge auth guard invariants", () => {
  const sharedAuth = "supabase/functions/_shared/auth.ts";
  const workflowScoped = [
    "supabase/functions/trigger-eas-build/index.ts",
    "supabase/functions/check-eas-build/index.ts",
    "supabase/functions/github-workflow-dispatch/index.ts",
    "supabase/functions/github-workflow-runs/index.ts",
    "supabase/functions/github-workflow-logs/index.ts",
    "supabase/functions/github-run-artifact-json/index.ts",
  ];
  it("defines the scoped edge auth guard and fails closed without configured route secrets", () => {
    const src = read(sharedAuth);
    expect(src).toContain("export type ScopedEdgeAuthConfig = {");
    expect(src).toContain("export function requireScopedEdgeAuth(req: Request, cfg: ScopedEdgeAuthConfig): Response | null {");
    expect(src).toContain('export const WORKFLOW_OPERATOR_ALLOWED_ROLES = ["service_role", "build_admin"] as const;');
    expect(src).toContain("export async function requireWorkflowOperatorJwtRole(req: Request, scope: string): Promise<Response | null> {");
    expect(src).toContain('"Missing required auth secrets for this Edge Function."');
    expect(src).toContain('"Unauthorized: send either admin key OR bearer token, not both."');
    expect(src).toContain('"Unauthorized: missing authentication header."');
    expect(src).toContain('accepted.push("x-k1w1-admin-key")');
  });

  it("moves workflow-facing edge functions onto scoped workflow admin+JWT secrets", () => {
    for (const rel of workflowScoped) {
      const src = read(rel);
      expect(src).toContain("requireScopedEdgeAuth");
      expect(src).toContain('adminSecretEnv: "K1W1_EDGE_WORKFLOW_ADMIN_KEY"');
            expect(src).toContain("allowJwtAuthHeaderWithAdmin: true");
      expect(src).not.toContain("ciBearerSecretEnv:");
      expect(src).not.toContain("isScopedCiBearerRequest(");
      expect(src).toContain("requireWorkflowOperatorJwtRole(req,");
      expect(src).not.toContain("const auth = requireAdminKey(req);");
      expect(src).not.toContain("const authError = requireAdminKey(req);");
    }
  });

  it("keeps android-keystore-export on a scoped admin-only route secret", () => {
    const src = read("supabase/functions/android-keystore-export/index.ts");
    expect(src).toContain("requireScopedEdgeAuth(req, {");
        expect(src).toContain('adminSecretEnv: "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY"');
    expect(src).toContain("requireJwtRole(req, {");
    expect(src).toContain('allowedRoles: ["service_role"]');
    expect(src).not.toContain("requireAdminKeyOrServiceRoleBearer");
  });

  it("keeps android-keystore-generate on the shared server-side service-role lookup", () => {
    const src = read("supabase/functions/android-keystore-generate/index.ts");
    const helpers = read("supabase/functions/android-keystore-generate/helpers.ts");
    expect(helpers).toContain("requireScopedEdgeAuth");
    expect(helpers).toContain("requirePrivilegedOperatorJwtRole");
    expect(src).toContain("const serviceKey = getServiceRoleKey(req);");
    expect(src).toContain("const supabaseUrl = getSupabaseUrl();");
    expect(src).toContain("const masterKey = getSigningMasterKey();");
    expect(src).not.toContain('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")');
    expect(src).not.toContain('Deno.env.get("SUPABASE_URL")');
    expect(src).not.toContain('Deno.env.get("SIGNING_MASTER_KEY")');
    expect(src).toContain("requireScopedEdgeAuth(req, {");
    expect(src).toContain('adminSecretEnv: "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY"');
        expect(src).toContain('const jwtRoleGuard = await requirePrivilegedOperatorJwtRole(req, "android-keystore-generate")');
  });

  it("keeps keystore wizard routes on scoped secret + privileged JWT roles", () => {
    const generateSrc = read("supabase/functions/android-keystore-generate/index.ts");
    const statusSrc = read("supabase/functions/android-keystore-status/index.ts");
    for (const src of [generateSrc, statusSrc]) {
      expect(src).toContain("requireScopedEdgeAuth(req, {");
      expect(src).toContain("allowAdmin: true");
            expect(src).toContain("allowJwtAuthHeaderWithAdmin: true");
      expect(src).toContain('adminSecretEnv: "K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY"');
      expect(src).not.toContain("requireAdminKey(req)");
      expect(src).not.toContain("requireAdminKeyOrServiceRoleBearer");
    }
    expect(generateSrc).toContain('requirePrivilegedOperatorJwtRole(req, "android-keystore-generate")');
    expect(statusSrc).toContain('requirePrivilegedOperatorJwtRole(req, "android-keystore-status")');
    expect(read("supabase/functions/android-keystore-generate/index.ts")).toContain("requireDurableRateLimit(req, {");
  });

  it("documents workflow and keystore routes with their scoped secrets", () => {
    const edgeStatus = read("docs/EDGE_FUNCTIONS_STATUS.md");
    expect(edgeStatus).toContain("K1W1_EDGE_WORKFLOW_ADMIN_KEY");
    expect(edgeStatus).toContain("K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY");
    expect(edgeStatus).toContain("`github-workflow-dispatch`");
    expect(edgeStatus).toContain("`android-keystore-export`");
  });

  it("keeps legacy generic routes on explicit K1W1_EDGE_ADMIN_KEY scoped guard contracts", () => {
    const genericRoutes = [
      "supabase/functions/k1w1-handler/index.ts",
      "supabase/functions/create_codesandbox/index.ts",
      "supabase/functions/save_preview/index.ts",
    ];

    for (const rel of genericRoutes) {
      const src = read(rel);
      expect(src).toContain("requireScopedEdgeAuth(req, {");
      expect(src).toContain('adminSecretEnv: "K1W1_EDGE_ADMIN_KEY"');
      expect(src).toContain("allowAdmin: true");
            expect(src).not.toContain("requireAdminKey(req)");
    }
  });
});
