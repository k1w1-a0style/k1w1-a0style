import { resolveHydratedSupabaseState } from "../screens/ConnectionsScreen/hooks/useConnectionsHydration";
import { STORAGE_KEYS } from "../lib/storageKeys";

describe("useConnectionsHydration supabase SoT contract", () => {
  it("derives hydration URL from canonical SUPABASE_RAW when mirror is stale", () => {
    const result = resolveHydratedSupabaseState({
      supabaseRaw: "xfgnzpcljsuqqdjlxgul",
      supabaseUrl: "https://stale.supabase.co",
    });

    expect(result.normalizedRaw).toBe("xfgnzpcljsuqqdjlxgul");
    expect(result.resolvedUrl).toBe("https://xfgnzpcljsuqqdjlxgul.supabase.co");
    expect(result.persistenceEntries).toContainEqual([
      STORAGE_KEYS.SUPABASE_URL,
      "https://xfgnzpcljsuqqdjlxgul.supabase.co",
    ]);
  });

  it("syncs both raw and mirror when hydration normalizes legacy raw format", () => {
    const result = resolveHydratedSupabaseState({
      supabaseRaw: "https://xfgnzpcljsuqqdjlxgul.supabase.co:::legacy",
      supabaseUrl: "",
    });

    expect(result.normalizedRaw).toBe("https://xfgnzpcljsuqqdjlxgul.supabase.co");
    expect(result.resolvedUrl).toBe("https://xfgnzpcljsuqqdjlxgul.supabase.co");
    expect(result.persistenceEntries).toEqual([
      [STORAGE_KEYS.SUPABASE_RAW, "https://xfgnzpcljsuqqdjlxgul.supabase.co"],
      [STORAGE_KEYS.SUPABASE_URL, "https://xfgnzpcljsuqqdjlxgul.supabase.co"],
    ]);
  });

  it("keeps mirror-only compat fallback when raw is not derivable", () => {
    const result = resolveHydratedSupabaseState({
      supabaseRaw: "not-derivable",
      supabaseUrl: "https://compat.supabase.co",
    });

    expect(result.normalizedRaw).toBe("https://compat.supabase.co");
    expect(result.resolvedUrl).toBe("https://compat.supabase.co");
    expect(result.persistenceEntries).toEqual([[STORAGE_KEYS.SUPABASE_RAW, "https://compat.supabase.co"]]);
  });
});
