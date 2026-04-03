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

  it("drops legacy secret composite formats so url:::key never persists", () => {
    expect(
      normalizeStoredSupabaseRaw(
        "https://xfgnzpcljsuqqdjlxgul.supabase.co:::eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
        "",
      ),
    ).toBe("");
  });
});
