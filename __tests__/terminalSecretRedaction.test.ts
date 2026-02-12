import { redactSecrets, truncateWithMarker } from "../lib/secretRedaction";

describe("Terminal secret redaction", () => {
  test("redacts apiKey assignments", () => {
    const input = 'Request failed: apiKey="sk_test_1234567890abcdef"';
    const out = redactSecrets(input);
    expect(out).toContain('apiKey="<redacted>"');
    expect(out).not.toContain("sk_test_1234567890abcdef");
  });

  test("redacts bearer tokens", () => {
    const input = "Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345";
    const out = redactSecrets(input);
    expect(out).toContain("Bearer <redacted>");
    expect(out).not.toContain("abcdefghijklmnopqrstuvwxyz012345");
  });

  test("redacts jwt-like tokens", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTYifQ.abcdefghijklmnopqrstuv";
    const out = redactSecrets(jwt);
    expect(out).toContain("<redacted-jwt>");
    expect(out).not.toContain("eyJhbGci");
  });

  test("truncateWithMarker adds marker", () => {
    const input = "x".repeat(50);
    const out = truncateWithMarker(input, 20, "<truncated>");
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out).toContain("<truncated>");
  });
});
