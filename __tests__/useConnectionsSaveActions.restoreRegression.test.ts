import { act, renderHook } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "../lib/storageKeys";
import { useConnectionsSaveActions } from "../screens/ConnectionsScreen/hooks/useConnectionsSaveActions";
import { resetSupabaseClient } from "../lib/supabase";

jest.mock("react-native", () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

jest.mock("../infra/github/githubService", () => ({
  getAndroidKeystoreExportAdminKey: jest.fn(async () => ""),
  getExpoToken: jest.fn(async () => ""),
  getGitHubToken: jest.fn(async () => ""),
  getWorkflowAdminKey: jest.fn(async () => ""),
  deleteAndroidKeystoreExportAdminKey: jest.fn(async () => {}),
  deleteExpoToken: jest.fn(async () => {}),
  deleteGitHubToken: jest.fn(async () => {}),
  deleteWorkflowAdminKey: jest.fn(async () => {}),
  saveAndroidKeystoreExportAdminKey: jest.fn(async () => {}),
  saveExpoToken: jest.fn(async () => {}),
  saveGitHubToken: jest.fn(async () => {}),
  saveWorkflowAdminKey: jest.fn(async () => {}),
}));

jest.mock("../lib/supabaseAnonKeyStorage", () => ({
  deleteSupabaseAnonKey: jest.fn(async () => {}),
  saveSupabaseAnonKey: jest.fn(async () => {}),
  getSupabaseAnonKey: jest.fn(async () => ""),
}));

jest.mock("../lib/easProjectIdScope", () => ({
  readScopedEasProjectId: jest.fn(async () => ""),
}));

jest.mock("../lib/supabase", () => ({
  resetSupabaseClient: jest.fn(),
}));

type Store = Map<string, string>;
const mockStore: Store = new Map();

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async (key: string) => (mockStore.has(key) ? mockStore.get(key)! : null)),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
  multiSet: jest.fn(async (pairs: Array<[string, string]>) => {
    for (const [k, v] of pairs) mockStore.set(k, v);
  }),
  multiRemove: jest.fn(async (keys: string[]) => {
    for (const k of keys) mockStore.delete(k);
  }),
}));

function makeParams(supabaseUrl: string) {
  return {
    hydrated: true,
    runGuardedAction: async (params: { task: () => Promise<void> }) => {
      await params.task();
    },
    secrets: {
      githubToken: "",
      expoToken: "",
      workflowAdminKey: "",
      androidKeystoreExportAdminKey: "",
      supabaseRaw: supabaseUrl,
      supabaseUrl,
      supabaseAnonKey: "",
      easProjectId: "",
    },
    persistSelectedEasProjectId: jest.fn(async () => {}),
    effectiveRepo: "owner/repo",
    clearGithubConnectionState: jest.fn(async () => {}),
    clearExpoConnectionState: jest.fn(async () => {}),
    clearEasConnectionState: jest.fn(async () => {}),
    clearSupabaseConnectionState: jest.fn(async () => {}),
    applyEasConnectionState: jest.fn(),
    setGitHubConnectionState: jest.fn(),
    setExpoConnectionState: jest.fn(),
    setRepoConnectionState: jest.fn(),
    setSupabaseConnectionState: jest.fn(),
  };
}

function makeJournalSnapshot(supabaseUrl: string) {
  return {
    repoScope: "owner/repo",
    githubToken: "",
    expoToken: "",
    workflowAdminKey: "",
    androidKeystoreExportAdminKey: "",
    supabaseRaw: supabaseUrl,
    supabaseUrl,
    supabaseAnonKey: "",
    easProjectId: "",
    sideState: {
      githubOkRaw: null,
      githubUserRaw: null,
      githubScopesRaw: null,
      expoOkRaw: null,
      expoUserRaw: null,
      repoOkRaw: null,
      repoSlugRaw: null,
      repoBranchRaw: null,
      supabaseOkRaw: null,
      supabaseRefRaw: null,
      easOkRaw: null,
      easStateRaw: null,
      easLastVerifiedAtRaw: null,
    },
  };
}

describe("useConnectionsSaveActions supabase reset restore regression", () => {
  beforeEach(() => {
    mockStore.clear();
    jest.clearAllMocks();
  });

  it("resets on recovery restore when live storage URL differs from snapshot URL", async () => {
    const liveUrl = "https://live.supabase.co";
    const snapshotUrl = "https://snapshot.supabase.co";
    await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_URL, liveUrl);
    await AsyncStorage.setItem(
      "connections_save_recoverable_journal_v1",
      JSON.stringify({
        version: 1,
        flow: "connections_save",
        createdAt: new Date().toISOString(),
        stage: "applying",
        snapshot: makeJournalSnapshot(snapshotUrl),
      }),
    );

    const { result } = renderHook(() => useConnectionsSaveActions(makeParams(snapshotUrl)));

    await act(async () => {
      await result.current.saveAll();
    });

    expect(resetSupabaseClient).toHaveBeenCalledTimes(1);
  });

  it("does not reset on recovery restore when live URL matches snapshot URL", async () => {
    const snapshotUrl = "https://same.supabase.co";
    await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_URL, snapshotUrl);
    await AsyncStorage.setItem(
      "connections_save_recoverable_journal_v1",
      JSON.stringify({
        version: 1,
        flow: "connections_save",
        createdAt: new Date().toISOString(),
        stage: "applying",
        snapshot: makeJournalSnapshot(snapshotUrl),
      }),
    );

    const { result } = renderHook(() => useConnectionsSaveActions(makeParams(snapshotUrl)));

    await act(async () => {
      await result.current.saveAll();
    });

    expect(resetSupabaseClient).toHaveBeenCalledTimes(0);
  });

  it("keeps normal save-path semantics and resets on actual URL change", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_URL, "https://old.supabase.co");
    const { result } = renderHook(() =>
      useConnectionsSaveActions(makeParams("https://new.supabase.co")),
    );

    await act(async () => {
      await result.current.saveAll();
    });

    expect(resetSupabaseClient).toHaveBeenCalledTimes(1);
  });

  it("keeps SUPABASE_URL mirror synchronized from canonical SUPABASE_RAW", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_URL, "https://old.supabase.co");
    const params = makeParams("https://xfgnzpcljsuqqdjlxgul.supabase.co");
    params.secrets.supabaseRaw = "xfgnzpcljsuqqdjlxgul";

    const { result } = renderHook(() => useConnectionsSaveActions(params));

    await act(async () => {
      await result.current.saveAll();
    });

    expect(await AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_RAW)).toBe("xfgnzpcljsuqqdjlxgul");
    expect(await AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL)).toBe(
      "https://xfgnzpcljsuqqdjlxgul.supabase.co",
    );
  });
});
