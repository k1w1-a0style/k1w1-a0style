import { renderHook, waitFor } from "@testing-library/react-native";

import { useConnectionsHydration } from "../screens/ConnectionsScreen/hooks/useConnectionsHydration";

const mockLoadHydrationSnapshot = jest.fn();
const mockResolveHydrationLightsState = jest.fn();

jest.mock("../screens/ConnectionsScreen/hooks/useConnectionsScreenState", () => ({
  loadHydrationSnapshot: (...args: unknown[]) => mockLoadHydrationSnapshot(...args),
  resolveHydrationLightsState: (...args: unknown[]) => mockResolveHydrationLightsState(...args),
}));

jest.mock("../lib/safeCleanup", () => ({
  runCleanupTask: jest.fn(async (task: () => Promise<void>) => {
    await task();
  }),
}));

jest.mock("../infra/github/githubService", () => ({
  getAndroidKeystoreExportAdminKey: jest.fn(async () => ""),
  getExpoToken: jest.fn(async () => ""),
  getGitHubToken: jest.fn(async () => ""),
  getWorkflowAdminKey: jest.fn(async () => ""),
}));

jest.mock("../lib/supabaseAnonKeyStorage", () => ({
  getSupabaseAnonKey: jest.fn(async () => ""),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async () => null),
}));

function makeBaseParams() {
  return {
    selectedRepo: "owner/repo",
    expoToken: "",
    setGithubToken: jest.fn(),
    setExpoToken: jest.fn(),
    setWorkflowAdminKey: jest.fn(),
    setAndroidKeystoreExportAdminKey: jest.fn(),
    setSupabaseRaw: jest.fn(),
    setSupabaseUrl: jest.fn(),
    setSupabaseAnonKey: jest.fn(),
    setEasProjectId: jest.fn(),
    setGithubOk: jest.fn(),
    setGithubUser: jest.fn(),
    setGithubScopes: jest.fn(),
    setSupabaseOk: jest.fn(),
    setSupabaseRef: jest.fn(),
    setExpoOk: jest.fn(),
    setExpoUser: jest.fn(),
    setRepoOk: jest.fn(),
    setRepoOkLine: jest.fn(),
    applyEasConnectionState: jest.fn(),
    persistConnLights: jest.fn(async () => {}),
    removeConnLights: jest.fn(async () => {}),
  };
}

describe("useConnectionsHydration Supabase SoT integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveHydrationLightsState.mockReturnValue({
      githubOk: false,
      githubUser: "",
      githubScopes: "",
      supabaseOk: false,
      supabaseRef: "",
      expoOk: false,
      expoUser: "",
      easOk: false,
      easState: "missing",
      easLastVerifiedAt: null,
      repoOk: false,
      repoOkLine: "",
    });
  });

  it("hydrates URL from canonical raw even when mirror is stale", async () => {
    mockLoadHydrationSnapshot.mockResolvedValueOnce({
      githubToken: "",
      expoToken: "",
      workflowAdminKey: "",
      androidKeystoreExportAdminKey: "",
      supabaseRaw: "xfgnzpcljsuqqdjlxgul",
      supabaseUrl: "https://stale.supabase.co",
      supabaseAnonKey: "",
      easProjectId: "",
      lights: {},
    });

    const params = makeBaseParams();
    renderHook(() => useConnectionsHydration(params));

    await waitFor(() => {
      expect(params.setSupabaseUrl).toHaveBeenCalledWith("https://xfgnzpcljsuqqdjlxgul.supabase.co");
    });
  });

  it("syncs raw + mirror when hydration normalizes legacy raw", async () => {
    mockLoadHydrationSnapshot.mockResolvedValueOnce({
      githubToken: "",
      expoToken: "",
      workflowAdminKey: "",
      androidKeystoreExportAdminKey: "",
      supabaseRaw: "https://xfgnzpcljsuqqdjlxgul.supabase.co:::legacy",
      supabaseUrl: "",
      supabaseAnonKey: "",
      easProjectId: "",
      lights: {},
    });

    const params = makeBaseParams();
    renderHook(() => useConnectionsHydration(params));

    await waitFor(() => {
      expect(params.persistConnLights).toHaveBeenCalledWith([
        ["supabase_raw", "https://xfgnzpcljsuqqdjlxgul.supabase.co"],
        ["supabase_url", "https://xfgnzpcljsuqqdjlxgul.supabase.co"],
      ]);
    });
  });

  it("keeps mirror-only fallback when raw is not derivable", async () => {
    mockLoadHydrationSnapshot.mockResolvedValueOnce({
      githubToken: "",
      expoToken: "",
      workflowAdminKey: "",
      androidKeystoreExportAdminKey: "",
      supabaseRaw: "n/a",
      supabaseUrl: "https://compat.supabase.co",
      supabaseAnonKey: "",
      easProjectId: "",
      lights: {},
    });

    const params = makeBaseParams();
    renderHook(() => useConnectionsHydration(params));

    await waitFor(() => {
      expect(params.setSupabaseUrl).toHaveBeenCalledWith("https://compat.supabase.co");
    });
  });
});
