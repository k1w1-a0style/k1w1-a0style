import {
  buildRepoOkLine,
  deriveSupabaseRefFromUrl,
  hasExpoProject,
  resolveEasTestPrecheck,
  resolveEasProjectVerification,
  isPersistedEasState,
  persistEntriesWithFallback,
  removeEntriesWithFallback,
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

    expect(
      resolvePersistedEasState({
        state: "legacy",
        easProjectId: "   ",
        lastVerifiedAt: null,
      }),
    ).toBeNull();
  });

  it("builds stable repo line display", () => {
    expect(buildRepoOkLine("owner/repo", "main")).toBe("owner/repo (main)");
    expect(buildRepoOkLine("owner/repo", null)).toBe("owner/repo");
    expect(buildRepoOkLine(null, "main")).toBe("");
    expect(buildRepoOkLine(" owner/repo ", " main ")).toBe("owner/repo (main)");
  });

  it("detects Expo project payload shape from known fields", () => {
    expect(hasExpoProject(null)).toBe(false);
    expect(hasExpoProject({ data: { id: "p1" } })).toBe(true);
    expect(hasExpoProject({ data: { project: { slug: "slug" } } })).toBe(true);
    expect(hasExpoProject({ data: {} })).toBe(false);
  });

  it("maps expo payload to verification contract without side effects", () => {
    expect(
      resolveEasProjectVerification({ data: { id: "p1" } }, "2026-03-31T00:00:00.000Z"),
    ).toEqual({
      ok: true,
      state: "verified",
      verifiedAt: "2026-03-31T00:00:00.000Z",
      hasProject: true,
    });

    expect(
      resolveEasProjectVerification({ data: {} }, "2026-03-31T00:00:00.000Z"),
    ).toEqual({
      ok: false,
      state: "unknown",
      verifiedAt: null,
      hasProject: false,
    });
  });

  it("resolves EAS test precheck outcomes deterministically", () => {
    expect(resolveEasTestPrecheck({ easProjectId: " ", expoToken: "token" })).toEqual({
      shouldStop: true,
      status: { ok: false, state: "missing" },
      alertMessage: null,
    });

    expect(resolveEasTestPrecheck({ easProjectId: "proj", expoToken: " " })).toEqual({
      shouldStop: true,
      status: { ok: false, state: "unknown" },
      alertMessage: "Expo Token fehlt (für EAS Test erforderlich)",
    });

    expect(resolveEasTestPrecheck({ easProjectId: "proj", expoToken: "token" })).toEqual({
      shouldStop: false,
      status: null,
      alertMessage: null,
    });
  });

  it("derives supabase project ref only from supabase hosts", () => {
    expect(deriveSupabaseRefFromUrl("https://abc123.supabase.co/rest/v1")).toBe("abc123");
    expect(deriveSupabaseRefFromUrl("https://example.com/rest/v1")).toBe("");
  });

  it("persists/removes storage entries with fallback when multi operations fail", async () => {
    const storage = {
      multiSet: jest.fn(async () => {
        throw new Error("no multi set");
      }),
      multiRemove: jest.fn(async () => {
        throw new Error("no multi remove");
      }),
      setItem: jest.fn(async () => undefined),
      removeItem: jest.fn(async () => undefined),
    };

    await persistEntriesWithFallback(storage, [
      ["k1", "v1"],
      ["k2", "v2"],
    ]);
    expect(storage.multiSet).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledTimes(2);

    await removeEntriesWithFallback(storage, ["k1", "k2"]);
    expect(storage.multiRemove).toHaveBeenCalledTimes(1);
    expect(storage.removeItem).toHaveBeenCalledTimes(2);
  });
});
