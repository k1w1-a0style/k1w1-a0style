import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("patch415 edge auth guard invariants", () => {
  const sharedAuth = "supabase/functions/_shared/auth.ts";
  const ciFacing = [
    "supabase/functions/trigger-eas-build/index.ts",
    "supabase/functions/check-eas-build/index.ts",
    "supabase/functions/github-workflow-dispatch/index.ts",
    "supabase/functions/github-workflow-runs/index.ts",
    "supabase/functions/github-workflow-logs/index.ts",
    "supabase/functions/github-run-artifact-json/index.ts",
    "supabase/functions/android-keystore-export/index.ts",
  ];
  const adminOnly = [
    "supabase/functions/android-keystore-generate/index.ts",
    "supabase/functions/android-keystore-status/index.ts",
  ];

  it("defines the shared admin-or-ci guard and fails closed without configured secrets", () => {
    const src = read(sharedAuth);
    expect(src).toContain("export function requireAdminKeyOrServiceRoleBearer(req: Request)");
    expect(src).toContain("if (!hasAdmin && !hasCi) {");
    expect(src).toContain('"Missing auth configuration for this Edge Function."');
    expect(src).toContain('500,');
    expect(src).toContain("const adminOk = hasAdmin && adminAuth === null;");
    expect(src).toContain("const ciOk = hasCi && ciAuth === null;");
    expect(src).toContain("if (adminOk || ciOk) return null;");
    expect(src).toContain("Unauthorized: missing or invalid admin key / CI bearer token.");
    expect(src).toContain("Authorization: Bearer <service-role-secret>");
  });

  it("moves workflow-facing edge functions onto the shared guard", () => {
    for (const rel of ciFacing) {
      const src = read(rel);
      expect(src).toContain("requireAdminKeyOrServiceRoleBearer");
      expect(src).not.toContain("const auth = requireAdminKey(req);");
      expect(src).not.toContain("const authError = requireAdminKey(req);");
    }
  });


  it("keeps android-keystore-generate on the shared server-side service-role lookup", () => {
    const src = read("supabase/functions/android-keystore-generate/index.ts");
    const helpers = read("supabase/functions/android-keystore-generate/helpers.ts");
    expect(helpers).toContain('export { getServiceRoleKey, rateLimit, requireAdminKey } from "../_shared/auth.ts";');
    expect(src).toContain("const serviceKey = getServiceRoleKey(req);");
    expect(src).not.toContain('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")');
  });

  it("keeps wizard-style keystore routes admin-only", () => {
    for (const rel of adminOnly) {
      const src = read(rel);
      expect(src).toContain("requireAdminKey(req)");
      expect(src).not.toContain("requireAdminKeyOrServiceRoleBearer");
    }
  });

  it("documents github-workflow-dispatch and android-keystore-export as shared-guard CI paths", () => {
    const readme = read("README.md");
    const todo = read("docs/TODO.md");
    const edgeStatus = read("docs/EDGE_FUNCTIONS_STATUS.md");
    expect(readme).toContain("Patch 415 V3");
    expect(todo).toContain("Patch 415");
    expect(edgeStatus).toContain("Admin-Key oder CI-Bearer");
    expect(edgeStatus).toContain("`github-workflow-dispatch`");
    expect(edgeStatus).toContain("`android-keystore-export`");
  });
});
