import {
  deriveSupabaseUrl,
  safeAlertText,
  validateBeforeSave,
} from "../screens/ConnectionsScreen/utils/validation";

describe("ConnectionsScreen validation", () => {
  test("deriveSupabaseUrl accepts full URL and normalizes https", () => {
    const out = deriveSupabaseUrl("http://abc123.supabase.co");
    expect(out.projectId).toBe("abc123");
    expect(out.url).toBe("https://abc123.supabase.co");
  });

  test("deriveSupabaseUrl accepts project id", () => {
    const out = deriveSupabaseUrl("xfgnzpcljsuqqdjlxgul");
    expect(out.projectId).toBe("xfgnzpcljsuqqdjlxgul");
    expect(out.url).toBe("https://xfgnzpcljsuqqdjlxgul.supabase.co");
  });

  test("validateBeforeSave rejects malformed GitHub token", () => {
    const res = validateBeforeSave({
      githubToken: "not-a-token",
      expoToken: "",
      workflowAdminKey: "",
      androidKeystoreExportAdminKey: "",
      legacyEdgeAdminKey: "",
      supabaseUrl: "",
      supabaseAnonKey: "",
    });
    expect(res.ok).toBe(false);
  });

  test("validateBeforeSave rejects whitespace in Expo token", () => {
    const res = validateBeforeSave({
      githubToken: "",
      expoToken: "abc def",
      workflowAdminKey: "",
      androidKeystoreExportAdminKey: "",
      legacyEdgeAdminKey: "",
      supabaseUrl: "",
      supabaseAnonKey: "",
    });
    expect(res.ok).toBe(false);
  });

  test("validateBeforeSave rejects non-supabase URL", () => {
    const res = validateBeforeSave({
      githubToken: "",
      expoToken: "",
      workflowAdminKey: "",
      androidKeystoreExportAdminKey: "",
      legacyEdgeAdminKey: "",
      supabaseUrl: "https://example.com",
      supabaseAnonKey: "",
    });
    expect(res.ok).toBe(false);
  });

  test("validateBeforeSave rejects non-jwt Supabase anon key", () => {
    const res = validateBeforeSave({
      githubToken: "",
      expoToken: "",
      workflowAdminKey: "",
      androidKeystoreExportAdminKey: "",
      legacyEdgeAdminKey: "",
      supabaseUrl: "https://abc123.supabase.co",
      supabaseAnonKey: "notjwt",
    });
    expect(res.ok).toBe(false);
  });

  test("validateBeforeSave accepts jwt-like Supabase anon key", () => {
    const jwtLike =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTYifQ.abcdefghijklmnopqrstuv";
    const res = validateBeforeSave({
      githubToken: "",
      expoToken: "",
      workflowAdminKey: "",
      androidKeystoreExportAdminKey: "",
      legacyEdgeAdminKey: "",
      supabaseUrl: "https://abc123.supabase.co",
      supabaseAnonKey: jwtLike,
    });
    expect(res.ok).toBe(true);
  });


  test("validateBeforeSave rejects malformed EAS project id", () => {
    const res = validateBeforeSave({
      githubToken: "",
      expoToken: "",
      workflowAdminKey: "",
      androidKeystoreExportAdminKey: "",
      legacyEdgeAdminKey: "",
      supabaseUrl: "",
      supabaseAnonKey: "",
      easProjectId: "not-a-uuid",
    });
    expect(res.ok).toBe(false);
  });

  test("validateBeforeSave accepts UUID-like EAS project id", () => {
    const res = validateBeforeSave({
      githubToken: "",
      expoToken: "",
      workflowAdminKey: "",
      androidKeystoreExportAdminKey: "",
      legacyEdgeAdminKey: "",
      supabaseUrl: "",
      supabaseAnonKey: "",
      easProjectId: "5e5a7791-8751-416b-9a1f-831adfffcb6c",
    });
    expect(res.ok).toBe(true);
  });

  test("validateBeforeSave rejects malformed local workflow admin key", () => {
    const res = validateBeforeSave({
      githubToken: "",
      expoToken: "",
      workflowAdminKey: "too short",
      androidKeystoreExportAdminKey: "",
      legacyEdgeAdminKey: "",
      supabaseUrl: "",
      supabaseAnonKey: "",
    });
    expect(res.ok).toBe(false);
  });

  test("validateBeforeSave rejects malformed local keystore admin key", () => {
    const res = validateBeforeSave({
      githubToken: "",
      expoToken: "",
      workflowAdminKey: "",
      androidKeystoreExportAdminKey: "bad key with spaces",
      legacyEdgeAdminKey: "",
      supabaseUrl: "",
      supabaseAnonKey: "",
    });
    expect(res.ok).toBe(false);
  });

  test("safeAlertText redacts secrets and truncates", () => {
    const msg =
      "Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345 " +
      "x".repeat(500);
    const out = safeAlertText(msg);
    expect(out).toContain("Bearer <redacted>");
    expect(out).not.toContain("abcdefghijklmnopqrstuvwxyz012345");
    expect(out.length).toBeLessThanOrEqual(180);
  });
});
