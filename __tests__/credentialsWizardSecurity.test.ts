import {
  isLikelyValidAdminKey,
  isLikelyValidRepoFullName,
  isLikelyValidSupabaseUrl,
  sanitizeErrorForUi,
  sanitizeWizardHttpDebug,
} from "../screens/CredentialsWizardScreen/utils/security";

describe("CredentialsWizard security helpers", () => {
  test("sanitizeWizardHttpDebug redacts JWT-like tokens", () => {
    const jwt = "aaaaaaaabbbbbbbb.ccccccccdddddddd.eeeeeeeeffffffff";
    const out = sanitizeWizardHttpDebug({
      url: "https://example.supabase.co/functions/v1/test",
      method: "POST",
      ms: 12,
      bodyText: `{"token":"${jwt}"}`,
    });
    expect(out.bodyText).toContain("<redacted-jwt>");
    expect(out.bodyText).not.toContain(jwt);
  });

  test("sanitizeErrorForUi redacts api key assignments", () => {
    const err = 'Request failed: apiKey="sk_test_1234567890abcdef"';
    const out = sanitizeErrorForUi(err);
    expect(out).toContain("apiKey=\"<redacted>\"");
    expect(out).not.toContain("sk_test_1234567890abcdef");
  });

  test("sanitizeWizardHttpDebug truncates large bodyText", () => {
    const huge = "x".repeat(8000);
    const out = sanitizeWizardHttpDebug({
      url: "https://example.supabase.co/functions/v1/test",
      method: "POST",
      ms: 12,
      bodyText: huge,
    });
    expect(out.bodyText!.length).toBeLessThanOrEqual(6100);
    expect(out.bodyText).toContain("<truncated>");
  });

  test("validators behave for common inputs", () => {
    expect(isLikelyValidSupabaseUrl("https://abc.supabase.co")).toBe(true);
    expect(isLikelyValidSupabaseUrl("http://abc.supabase.co")).toBe(false);
    expect(isLikelyValidSupabaseUrl("not a url")).toBe(false);

    expect(isLikelyValidRepoFullName("owner/repo")).toBe(true);
    expect(isLikelyValidRepoFullName("owner")).toBe(false);

    expect(isLikelyValidAdminKey("aaaaaaaabbbbbbbb.ccccccccdddddddd.eeeeeeeeffffffff")).toBe(true);
    expect(isLikelyValidAdminKey("short")).toBe(false);
  });
});
