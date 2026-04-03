import { deriveSupabaseUrl, normalizeStoredSupabaseRaw } from "../screens/ConnectionsScreen/utils/validation";

describe("normalizeStoredSupabaseRaw", () => {
  it("keeps a project ref as compact ref", () => {
    expect(normalizeStoredSupabaseRaw("xfgnzpcljsuqqdjlxgul", "")).toBe("xfgnzpcljsuqqdjlxgul");
  });

  it("normalizes a Supabase URL", () => {
    expect(normalizeStoredSupabaseRaw("https://xfgnzpcljsuqqdjlxgul.supabase.co", "")).toBe(
      "https://xfgnzpcljsuqqdjlxgul.supabase.co",
    );
  });

  it("falls back to the derived URL when raw input is not persistable", () => {
    const derived = deriveSupabaseUrl("xfgnzpcljsuqqdjlxgul").url;
    expect(normalizeStoredSupabaseRaw("project=xfgnzpcljsuqqdjlxgul", derived)).toBe(derived);
  });

  it("returns empty when neither raw nor url can be normalized", () => {
    expect(normalizeStoredSupabaseRaw("not a supabase target", "")).toBe("");
  });

  it("keeps normalized URL for legacy url:::key format while dropping secret", () => {
    const normalized = normalizeStoredSupabaseRaw(
      "https://xfgnzpcljsuqqdjlxgul.supabase.co:::eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      "",
    );
    expect(normalized).toBe("https://xfgnzpcljsuqqdjlxgul.supabase.co");
    expect(normalized).not.toContain(":::");
    expect(normalized).not.toContain("eyJ");
  });

  it("keeps project ref for legacy project-ref:::secret format while dropping secret", () => {
    const normalized = normalizeStoredSupabaseRaw(
      "xfgnzpcljsuqqdjlxgul:::super-secret-token",
      "",
    );
    expect(normalized).toBe("xfgnzpcljsuqqdjlxgul");
    expect(normalized).not.toContain(":::");
    expect(normalized).not.toContain("super-secret-token");
  });

  it("returns empty for unusable legacy composite values", () => {
    expect(normalizeStoredSupabaseRaw(":::definitely-not-a-url-or-project", "")).toBe("");
  });
});
