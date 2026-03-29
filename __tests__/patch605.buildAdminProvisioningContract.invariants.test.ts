import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("patch605 build_admin provisioning contract invariants", () => {
  it("keeps operator-role SoT fail-closed without introducing a repo-local build_admin mapper", () => {
    const auth = read("supabase/functions/_shared/auth.ts");
    expect(auth).toContain('export const WORKFLOW_OPERATOR_ALLOWED_ROLES = ["service_role", "build_admin"] as const;');
    expect(auth).toContain('export const PRIVILEGED_OPERATOR_ALLOWED_ROLES = ["service_role", "build_admin"] as const;');
    expect(auth).toContain('const authUrl = `${supabaseUrl.replace(/\\/$/, "")}/auth/v1/user`;');
    expect(auth).not.toContain("grantBuildAdmin");
    expect(auth).not.toContain("setBuildAdmin");
  });

  it("keeps caller and wizard errors explicit about external build_admin provisioning", () => {
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
      expect(src).toContain("service_role fuer Server-Caller");
      expect(src).toContain("ausserhalb dieses Repos per Supabase-User-Claim vergeben");
      expect(src).toContain("Normale eingeloggte Nutzer ohne extern provisionierten build_admin-Claim");
    }
  });

  it("keeps docs and contract checker aligned with external provisioning statement", () => {
    const script = read("scripts/check_workflow_edge_contracts.sh");
    const edgeStatus = read("docs/EDGE_FUNCTIONS_STATUS.md");
    const readiness = read("docs/06-build-readiness.md");
    const risk = read("docs/04-risk-hotspots.md");

    expect(script).toContain('require_fixed "$BUILD_START_SERVICE" "ausserhalb dieses Repos per Supabase-User-Claim vergeben"');
    expect(script).toContain('require_fixed "$BUILD_START_SERVICE" "Normale eingeloggte Nutzer ohne extern provisionierten build_admin-Claim"');
    expect(edgeStatus).toContain("build_admin-Claim wird nicht im Repo erzeugt");
    expect(readiness).toContain("build_admin-Claim wird im Betriebs-/Provisioning-Prozess ausserhalb dieses Repos vergeben");
    expect(risk).toContain("Es gibt im Repo keinen internen Claim-Mapper/Grant-Flow fuer build_admin");
  });
});
