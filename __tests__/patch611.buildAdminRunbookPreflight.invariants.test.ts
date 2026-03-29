import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("patch611 build_admin operator runbook preflight invariants", () => {
  it("keeps operator caller guidance explicit and fail-closed for non-provisioned users", () => {
    const files = [
      "project/services/buildStartService.ts",
      "project/services/buildPollingService.ts",
      "hooks/useGitHubActionsLogs.ts",
      "components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts",
      "screens/CredentialsWizardScreen/hooks/useCredentialsWizardScreen.ts",
    ];

    for (const rel of files) {
      const src = read(rel);
      expect(src).toContain("Normale eingeloggte Nutzer ohne extern provisionierten build_admin-Claim");
      expect(src).toContain("fail-closed blockiert");
    }
  });

  it("keeps the runbook/preflight docs explicit about external provisioning responsibilities", () => {
    const readiness = read("docs/06-build-readiness.md");
    const edgeStatus = read("docs/EDGE_FUNCTIONS_STATUS.md");

    expect(readiness).toContain("Operator-Runbook/Preflight (extern provisionierter `build_admin`-Vertrag)");
    expect(readiness).toContain("Ein normales eingeloggtes User-JWT ohne externen `build_admin`-Claim ist **nicht ausreichend**.");
    expect(readiness).toContain("Bei Blockierung nicht am Repo mappen: Claim extern korrigieren und Test wiederholen.");
    expect(edgeStatus).toContain("normale eingeloggte Nutzer ohne extern provisionierten build_admin-Claim");
  });
});
