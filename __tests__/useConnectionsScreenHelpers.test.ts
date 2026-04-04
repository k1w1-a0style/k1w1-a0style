import {
  buildRepoOkLine,
  deriveSupabaseRefFromUrl,
  hasExpoProject,
  resolveEasTestPrecheck,
  resolveEasProjectVerification,
  isPersistedEasState,
  persistEntriesWithFallback,
  resolveConnectionsStatusFlags,
  resolveEasLinkWorkflowStartMessage,
  resolveConnectionsAlertNotice,
  resolveLinkExistingSelectionPrecheck,
  removeEntriesWithFallback,
  resolvePersistedEasState,
} from "../screens/ConnectionsScreen/hooks/useConnectionsScreenHelpers";
import {
  easClearedPersistence,
  expoClearedPersistence,
  githubClearedPersistence,
  loadHydrationSnapshot,
  resolveHydrationLightsState,
  supabaseClearedPersistence,
} from "../screens/ConnectionsScreen/hooks/useConnectionsScreenState";
import { STORAGE_KEYS } from "../lib/storageKeys";

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

  it("derives connection status flags deterministically", () => {
    expect(
      resolveConnectionsStatusFlags({
        githubToken: " gh ",
        expoToken: "",
        workflowAdminKey: " ",
        androidKeystoreExportAdminKey: "k",
        supabaseUrl: " https://x.supabase.co ",
        supabaseAnonKey: "",
        linkedRepo: "",
        activeRepo: "owner/repo",
        easProjectId: "550e8400-e29b-41d4-a716-446655440000",
      }),
    ).toEqual({
      gh: true,
      ex: false,
      edge: true,
      sbUrl: true,
      sbAnon: false,
      linked: true,
      eas: true,
    });
  });

  it("resolves link-existing selection precheck errors deterministically", () => {
    expect(
      resolveLinkExistingSelectionPrecheck({
        githubToken: "",
        repoSlug: "owner/repo",
        branch: "main",
      }),
    ).toEqual({
      ok: false,
      alertTitle: "Fehler",
      alertMessage: "GitHub Token fehlt (oder ist leer).",
    });

    expect(
      resolveLinkExistingSelectionPrecheck({
        githubToken: "token",
        repoSlug: "",
        branch: "main",
      }),
    ).toEqual({
      ok: false,
      alertTitle: "Fehler",
      alertMessage: "Kein Repo ausgewählt.",
    });

    expect(
      resolveLinkExistingSelectionPrecheck({
        githubToken: "token",
        repoSlug: "owner/repo",
        branch: "",
      }),
    ).toEqual({
      ok: false,
      alertTitle: "Fehler",
      alertMessage: "Kein Branch ausgewählt. Bitte zuerst in GitHub Repos einen Branch verknüpfen.",
    });

    expect(
      resolveLinkExistingSelectionPrecheck({
        githubToken: "token",
        repoSlug: "owner/repo",
        branch: "main",
      }),
    ).toEqual({
      ok: true,
      alertTitle: null,
      alertMessage: null,
    });
  });

  it("maps EAS link workflow start messages deterministically", () => {
    expect(resolveEasLinkWorkflowStartMessage("project-id")).toContain("EAS Link-Workflow gestartet");
    expect(resolveEasLinkWorkflowStartMessage("")).toContain("Keine EAS ID vorhanden");
  });

  it("maps connections alert notices deterministically", () => {
    expect(resolveConnectionsAlertNotice("missing_github_token")).toEqual({
      title: "Fehler",
      message: "GitHub Token fehlt (oder ist leer).",
    });
    expect(resolveConnectionsAlertNotice("missing_repo_selection")).toEqual({
      title: "Fehler",
      message: "Kein Repo ausgewählt.",
    });
    expect(resolveConnectionsAlertNotice("missing_branch_selection")).toEqual({
      title: "Fehler",
      message: "Kein Branch ausgewählt. Bitte zuerst in GitHub Repos einen Branch verknüpfen.",
    });
    expect(resolveConnectionsAlertNotice("invalid_repo_format")).toEqual({
      title: "Fehler",
      message: "Repo-Format ist ungültig. Erwartet: owner/repo",
    });
    expect(resolveConnectionsAlertNotice("create_link_workflow_started")).toEqual({
      title: "OK",
      message: "EAS Create+Link Workflow gestartet. Check GitHub Actions (eas-link) und danach Repo commit/push abwarten.",
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

  it("restores hydration lights deterministically from persisted connection keys", () => {
    expect(
      resolveHydrationLightsState({
        ghOk: "true",
        ghUserStored: "octocat",
        ghScopesStored: "repo,workflow",
        sbOk: "true",
        sbRefStored: "abc123",
        exOk: "true",
        exUserStored: "expo-user",
        easOkStored: "true",
        easStateStored: null,
        easLastVerifiedStored: "2026-04-03T00:00:00.000Z",
        repoOkStored: "true",
        repoSlug: "owner/repo",
        repoBranch: "main",
        easProjectId: "550e8400-e29b-41d4-a716-446655440000",
      }),
    ).toEqual({
      githubOk: true,
      githubUser: "octocat",
      githubScopes: "repo,workflow",
      supabaseOk: true,
      supabaseRef: "abc123",
      expoOk: true,
      expoUser: "expo-user",
      easOk: true,
      easState: "verified",
      easLastVerifiedAt: "2026-04-03T00:00:00.000Z",
      repoOk: true,
      repoOkLine: "owner/repo (main)",
    });
  });

  it("keeps reset persistence payloads stable for save/delete side effects", () => {
    expect(githubClearedPersistence()).toEqual({
      writes: [
        [STORAGE_KEYS.CONN_GITHUB_OK, "false"],
        [STORAGE_KEYS.CONN_REPO_OK, "false"],
        [STORAGE_KEYS.CONN_EAS_OK, "false"],
        [STORAGE_KEYS.CONN_EAS_STATE, "missing"],
      ],
      removes: [
        STORAGE_KEYS.CONN_GITHUB_USER,
        STORAGE_KEYS.CONN_GITHUB_SCOPES,
        STORAGE_KEYS.CONN_REPO_SLUG,
        STORAGE_KEYS.CONN_REPO_BRANCH,
        STORAGE_KEYS.CONN_EAS_LAST_VERIFIED_AT,
      ],
    });

    expect(expoClearedPersistence()).toEqual({
      writes: [[STORAGE_KEYS.CONN_EXPO_OK, "false"]],
      removes: [STORAGE_KEYS.CONN_EXPO_USER],
    });

    expect(easClearedPersistence()).toEqual({
      writes: [
        [STORAGE_KEYS.CONN_EAS_OK, "false"],
        [STORAGE_KEYS.CONN_EAS_STATE, "missing"],
      ],
      removes: [STORAGE_KEYS.CONN_EAS_LAST_VERIFIED_AT],
    });

    expect(supabaseClearedPersistence()).toEqual({
      writes: [[STORAGE_KEYS.CONN_SUPABASE_OK, "false"]],
      removes: [STORAGE_KEYS.CONN_SUPABASE_REF],
    });
  });

  it("loads hydration snapshot fail-safe across token, storage and light keys", async () => {
    const values = new Map<string, string | null>([
      [STORAGE_KEYS.SUPABASE_RAW, "https://abc.supabase.co:::legacy"],
      [STORAGE_KEYS.SUPABASE_URL, "https://abc.supabase.co"],
      [STORAGE_KEYS.EAS_PROJECT_ID, "550e8400-e29b-41d4-a716-446655440000"],
      [STORAGE_KEYS.CONN_GITHUB_OK, "true"],
      [STORAGE_KEYS.CONN_GITHUB_USER, "octocat"],
      [STORAGE_KEYS.CONN_GITHUB_SCOPES, "repo"],
      [STORAGE_KEYS.CONN_SUPABASE_OK, "true"],
      [STORAGE_KEYS.CONN_SUPABASE_REF, "abc"],
      [STORAGE_KEYS.CONN_EXPO_OK, "true"],
      [STORAGE_KEYS.CONN_EXPO_USER, "expo-user"],
      [STORAGE_KEYS.CONN_EAS_OK, "true"],
      [STORAGE_KEYS.CONN_EAS_STATE, "verified"],
      [STORAGE_KEYS.CONN_EAS_LAST_VERIFIED_AT, "2026-04-03T00:00:00.000Z"],
      [STORAGE_KEYS.CONN_REPO_OK, "true"],
      [STORAGE_KEYS.CONN_REPO_SLUG, "owner/repo"],
      [STORAGE_KEYS.CONN_REPO_BRANCH, "main"],
    ]);
    const storage = {
      getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    };

    const snapshot = await loadHydrationSnapshot(storage, {
      getGitHubToken: async () => "gh-token",
      getExpoToken: async () => "expo-token",
      getWorkflowAdminKey: async () => "workflow-admin",
      getAndroidKeystoreExportAdminKey: async () => "keystore-admin",
      getSupabaseAnonKey: async () => "anon-key",
    });

    expect(snapshot.githubToken).toBe("gh-token");
    expect(snapshot.expoToken).toBe("expo-token");
    expect(snapshot.workflowAdminKey).toBe("workflow-admin");
    expect(snapshot.androidKeystoreExportAdminKey).toBe("keystore-admin");
    expect(snapshot.supabaseRaw).toBe("https://abc.supabase.co:::legacy");
    expect(snapshot.supabaseUrl).toBe("https://abc.supabase.co");
    expect(snapshot.supabaseAnonKey).toBe("anon-key");
    expect(snapshot.easProjectId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(snapshot.lights.repoSlug).toBe("owner/repo");
    expect(snapshot.lights.repoBranch).toBe("main");
  });
});
