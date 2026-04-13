import { hasAllowedOperatorRole, readOperatorJwtRole } from "../lib/auth/operatorJwt";

describe("operatorJwt", () => {
  const buildAdminJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYnVpbGRfYWRtaW4ifQ.signature";
  const invalidRoleJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoidXNlciJ9.signature";

  it("reads role from JWT payload only (no signature verification)", () => {
    expect(readOperatorJwtRole(buildAdminJwt)).toBe("build_admin");
  });

  it("accepts only build_admin or service_role", () => {
    expect(hasAllowedOperatorRole(buildAdminJwt)).toBe(true);
    expect(hasAllowedOperatorRole(invalidRoleJwt)).toBe(false);
    expect(hasAllowedOperatorRole("not-a-jwt")).toBe(false);
  });
});
