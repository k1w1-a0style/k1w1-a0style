import {
  buildRepoOkLine,
  deriveSupabaseRefFromUrl,
  hasExpoProject,
  isPersistedEasState,
  resolvePersistedEasState,
} from "../screens/ConnectionsScreen/hooks/useConnectionsScreenHelpers";

describe("useConnectionsScreenHelpers", () => {
  it("accepts only persisted EAS contract states", () => {
    expect(isPersistedEasState("verified")).toBe(true);
    expect(isPersistedEasState("stale")).toBe(true);
    expect(isPersistedEasState("running")).toBe(false);
    expect(isPersistedEasState(null)).toBe(false);
  });

  it("resolves fallback EAS state from stored project metadata", () => {
    expect(
      resolvePersistedEasState({
        state: null,
        easProjectId: "",
        lastVerifiedAt: null,
      }),
    ).toBeNull();

    expect(
      resolvePersistedEasState({
        state: "unknown",
        easProjectId: "",
        lastVerifiedAt: null,
      }),
    ).toBe("unknown");

    expect(
      resolvePersistedEasState({
        state: "legacy",
        easProjectId: "proj",
        lastVerifiedAt: null,
      }),
    ).toBe("stale");

    expect(
      resolvePersistedEasState({
        state: "legacy",
        easProjectId: "proj",
        lastVerifiedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toBe("verified");
  });

  it("builds stable repo line display", () => {
    expect(buildRepoOkLine("owner/repo", "main")).toBe("owner/repo (main)");
    expect(buildRepoOkLine("owner/repo", null)).toBe("owner/repo");
  });

  it("detects Expo project payload shape from known fields", () => {
    expect(hasExpoProject(null)).toBe(false);
    expect(hasExpoProject({ data: { id: "p1" } })).toBe(true);
    expect(hasExpoProject({ data: { project: { slug: "slug" } } })).toBe(true);
    expect(hasExpoProject({ data: {} })).toBe(false);
  });

  it("derives supabase project ref only from supabase hosts", () => {
    expect(deriveSupabaseRefFromUrl("https://abc123.supabase.co/rest/v1")).toBe("abc123");
    expect(deriveSupabaseRefFromUrl("https://example.com/rest/v1")).toBe("");
  });
});
