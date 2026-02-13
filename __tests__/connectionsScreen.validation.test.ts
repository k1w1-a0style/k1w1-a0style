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
      edgeAdminKey: "",
      supabaseUrl: "",
      supabaseAnonKey: "",
      supabaseServiceRoleKey: "",
    });
    expect(res.ok).toBe(false);
  });

  test("validateBeforeSave rejects whitespace in Expo token", () => {
    const res = validateBeforeSave({
      githubToken: "",
      expoToken: "abc def",
      edgeAdminKey: "",
      supabaseUrl: "",
      supabaseAnonKey: "",
      supabaseServiceRoleKey: "",
    });
    expect(res.ok).toBe(false);
  });

  test("validateBeforeSave rejects non-supabase URL", () => {
    const res = validateBeforeSave({
      githubToken: "",
      expoToken: "",
      edgeAdminKey: "",
      supabaseUrl: "https://example.com",
      supabaseAnonKey: "",
      supabaseServiceRoleKey: "",
    });
    expect(res.ok).toBe(false);
  });

  test("validateBeforeSave rejects non-jwt Supabase keys", () => {
    const res = validateBeforeSave({
      githubToken: "",
      expoToken: "",
      edgeAdminKey: "",
      supabaseUrl: "https://abc123.supabase.co",
      supabaseAnonKey: "notjwt",
      supabaseServiceRoleKey: "also-not-jwt",
    });
    expect(res.ok).toBe(false);
  });

  test("validateBeforeSave accepts jwt-like Supabase keys", () => {
    const jwtLike =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTYifQ.abcdefghijklmnopqrstuv";
    const res = validateBeforeSave({
      githubToken: "",
      expoToken: "",
      edgeAdminKey: "",
      supabaseUrl: "https://abc123.supabase.co",
      supabaseAnonKey: jwtLike,
      supabaseServiceRoleKey: jwtLike,
    });
    expect(res.ok).toBe(true);
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
