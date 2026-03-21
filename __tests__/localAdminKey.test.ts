import {
  describeLocalEdgeAdminKeyIssue,
  inferLocalEdgeAdminKeyIssueKind,
} from "../screens/CredentialsWizardScreen/utils/localAdminKey";

describe("local Edge Admin Key diagnosis", () => {
  const validKey = "edge-admin-key-12345678901234567890";

  it("classifies a present but server-rejected local key as rejected, not missing", () => {
    expect(
      inferLocalEdgeAdminKeyIssueKind({
        adminKey: validKey,
        statusCode: 401,
        error: "Unauthorized: missing or invalid admin key",
      }),
    ).toBe("rejected");
  });

  it("keeps a truly absent local key as missing", () => {
    expect(
      inferLocalEdgeAdminKeyIssueKind({
        adminKey: "   ",
        statusCode: 401,
        error: "Unauthorized: missing or invalid admin key",
      }),
    ).toBe("missing");
  });

  it("keeps a formally broken local key as invalid", () => {
    expect(
      inferLocalEdgeAdminKeyIssueKind({
        adminKey: "short key",
        error: "Forbidden",
      }),
    ).toBe("invalid");
  });

  it("never leaks the raw admin key in user-facing diagnosis text", () => {
    const message = describeLocalEdgeAdminKeyIssue({
      adminKey: validKey,
      statusCode: 403,
      error: "x-k1w1-admin-key invalid admin",
    });

    expect(message).toMatch(/abgelehnt/i);
    expect(message).not.toContain(validKey);
  });
});
