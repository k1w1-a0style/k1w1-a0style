import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("patch604 workflow/keystore operator caller contract invariants", () => {
  it("keeps privileged JWT role SoT fail-closed on build_admin|service_role", () => {
    const auth = read("supabase/functions/_shared/auth/jwt.ts");
    expect(auth).toContain('export const WORKFLOW_OPERATOR_ALLOWED_ROLES = ["service_role", "build_admin"] as const;');
    expect(auth).toContain('export const PRIVILEGED_OPERATOR_ALLOWED_ROLES = ["service_role", "build_admin"] as const;');
  });

  it("removes stale role=authenticated caller copy from app-initiated workflow/build/artifact paths", () => {
    const files = [
      "project/services/buildStartService.ts",
      "project/services/buildPollingService.ts",
      "hooks/useGitHubActionsLogs.ts",
      "components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts",
      "screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts",
    ];

    for (const rel of files) {
      const src = read(rel);
      expect(src).toContain("build_admin");
      expect(src).not.toContain("JWT role=authenticated");
    }
  });

  it("keeps workflow contract checker aligned with operator-role caller text", () => {
    const script = read("scripts/check_workflow_edge_contracts.sh");
    expect(script).toContain('forbid_fixed "$BUILD_START_SERVICE" "JWT role=authenticated"');
    expect(script).toContain('forbid_fixed "$WORKFLOW_LOGS_HOOK" "JWT role=authenticated"');
    expect(script).toContain('require_fixed "$CI_LITE_WORKFLOW_HOOK" "JWT role=build_admin (oder service_role fuer Server-Caller)"');
  });
});
