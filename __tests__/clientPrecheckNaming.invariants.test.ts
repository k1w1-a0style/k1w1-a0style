import { readRepoText } from "./helpers/repoSourceHelpers";

describe("client precheck naming invariants", () => {
  it("keeps client auth/admin helpers explicitly non-authoritative in naming", () => {
    const operatorJwt = readRepoText("lib/auth/operatorJwt.ts");
    const adminKeyHelper = readRepoText("lib/security/isLikelyWellFormedAdminKeyForUiPrecheck.ts");
    const buildPreconditions = readRepoText("screens/EnhancedBuildScreen/hooks/useBuildPreconditions.ts");

    expect(operatorJwt).toContain("readOperatorRoleClaimForUiPrecheck");
    expect(operatorJwt).toContain("hasLikelyAllowedOperatorRoleForUiPrecheck");
    expect(operatorJwt).not.toContain("readOperatorJwtRole");
    expect(operatorJwt).not.toContain("hasAllowedOperatorRole");
    expect(adminKeyHelper).toContain("isLikelyWellFormedAdminKeyForUiPrecheck");
    expect(buildPreconditions).toContain("hasLikelyAllowedOperatorRoleForUiPrecheck");
  });
});
