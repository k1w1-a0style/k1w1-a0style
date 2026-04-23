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

  test("redacts github tokens and x-k1w1-admin-key header", () => {
    const input = [
      "x-k1w1-admin-key: super-secret-admin-key",
      "token=ghp_abcdefghijklmnopqrstuvwxyz1234567890",
      "github_pat_11ABCDEF_abcdefghijklmnopqrstuvwxyz1234567890",
    ].join("\n");
    const out = redactSecrets(input);
    expect(out).toMatch(/x-k1w1-admin-key[:=]"?<redacted>"?/i);
    expect(out).not.toContain("super-secret-admin-key");
    expect(out).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz1234567890");
    expect(out).not.toContain("github_pat_11ABCDEF_abcdefghijklmnopqrstuvwxyz1234567890");
  });

  test("redacts jwt-like tokens", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTYifQ.abcdefghijklmnopqrstuv";
    const out = redactSecrets(jwt);
    expect(out).toContain("<redacted-jwt>");
    expect(out).not.toContain("eyJhbGci");
  });


  test("redacts cookies and credential assignments", () => {
    const input = "Cookie: session=abc123\npassword=hunter2\nclient_secret=topsecret";
    const out = redactSecrets(input);
    expect(out).toContain("Cookie: <redacted>");
    expect(out).toContain('password="<redacted>"');
    expect(out).toContain('client_secret="<redacted>"');
    expect(out).not.toContain("abc123");
    expect(out).not.toContain("hunter2");
    expect(out).not.toContain("topsecret");
  });

  test("redacts project-style key assignments while preserving harmless debug text", () => {
    const input = [
      "workflow_admin_key=my-long-secret-value",
      "SIGNING_MASTER_KEY=another-secret",
      "SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiJ9.aaaaabbbbb.ccccdddd",
      "status: waiting for next retry",
    ].join("\n");
    const out = redactSecrets(input);
    expect(out).toContain('workflow_admin_key="<redacted>"');
    expect(out).toContain('SIGNING_MASTER_KEY="<redacted>"');
    expect(out).toContain('SUPABASE_ANON_KEY="<redacted>"');
    expect(out).toContain("status: waiting for next retry");
  });



  test("redacts provider-specific key formats", () => {
    const input = [
      "groq=gsk_abcdefghijklmnopqrstuvwxyz012345",
      "anthropic=sk-ant-api03-abcdefghijklmnopqrstuvwxyz",
      "gemini=AIzaSyA1234567890abcdefghijklmnopqrstuv",
      "hf=hf_abcdefghijklmnopqrstuvwxyz0123456789",
    ].join("\n");

    const out = redactSecrets(input);
    expect(out).not.toContain("gsk_abcdefghijklmnopqrstuvwxyz012345");
    expect(out).not.toContain("sk-ant-api03-abcdefghijklmnopqrstuvwxyz");
    expect(out).not.toContain("AIzaSyA1234567890abcdefghijklmnopqrstuv");
    expect(out).not.toContain("hf_abcdefghijklmnopqrstuvwxyz0123456789");
    expect(out.match(/<redacted>/g)?.length || 0).toBeGreaterThanOrEqual(4);
  });

  test("keeps harmless status text readable", () => {
    const input = "status: model retry disabled for now";
    expect(redactSecrets(input)).toBe(input);
  });

  test("truncateWithMarker adds marker", () => {
    const input = "x".repeat(50);
    const out = truncateWithMarker(input, 20, "<truncated>");
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out).toContain("<truncated>");
  });
});
