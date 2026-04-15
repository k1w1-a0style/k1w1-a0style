import { hasLikelyAllowedOperatorRoleForUiPrecheck, readOperatorRoleClaimForUiPrecheck } from "../lib/auth/operatorJwt";

describe("operatorJwt", () => {
  const buildAdminJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYnVpbGRfYWRtaW4ifQ.signature";
  const buildAdminJwtWithDifferentSignature = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYnVpbGRfYWRtaW4ifQ.anything";
  const invalidRoleJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoidXNlciJ9.signature";
  const appMetadataRoleJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcHBfbWV0YWRhdGEiOnsicm9sZSI6InNlcnZpY2Vfcm9sZSJ9fQ.signature";
  const invalidPayloadJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.bm90LWpzb24.signature";

  it("reads role from JWT payload only (no signature verification)", () => {
    expect(readOperatorRoleClaimForUiPrecheck(buildAdminJwt)).toBe("build_admin");
  });

  it("accepts only build_admin or service_role", () => {
    expect(hasLikelyAllowedOperatorRoleForUiPrecheck(buildAdminJwt)).toBe(true);
    expect(hasLikelyAllowedOperatorRoleForUiPrecheck(buildAdminJwtWithDifferentSignature)).toBe(true);
    expect(hasLikelyAllowedOperatorRoleForUiPrecheck(appMetadataRoleJwt)).toBe(true);
    expect(hasLikelyAllowedOperatorRoleForUiPrecheck(invalidRoleJwt)).toBe(false);
    expect(readOperatorRoleClaimForUiPrecheck(invalidPayloadJwt)).toBeNull();
    expect(hasLikelyAllowedOperatorRoleForUiPrecheck("not-a-jwt")).toBe(false);
  });
});
