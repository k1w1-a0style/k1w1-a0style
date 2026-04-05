import { act, cleanup, renderHook } from "@testing-library/react-native";

import { useGitHubReposScreen } from "../screens/GitHubReposScreen/hooks/useGitHubReposScreen";
import { checkRepoEasLinkStatus, getEasLinkPresentation } from "../screens/GitHubReposScreen/utils/easLinkContract";

const mockGetItem = jest.fn(async (_key?: string) => "11111111-1111-1111-1111-111111111111");
const mockSetItem = jest.fn(async (_key?: string, _value?: string) => undefined);
const mockRemoveItem = jest.fn(async (_key?: string) => undefined);

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
    removeItem: (key: string) => mockRemoveItem(key),
  },
}));

const mockGitHubState = {
  activeRepo: "owner/repo-a",
  setActiveRepo: jest.fn(),
  activeBranch: "main",
  setActiveBranch: jest.fn(),
  recentRepos: [] as string[],
  addRecentRepo: jest.fn(),
  clearRecentRepos: jest.fn(),
};
const mockProjectData = {
  files: [] as Array<{ path: string; content: string }>,
  linkedRepo: mockGitHubState.activeRepo,
  linkedBranch: mockGitHubState.activeBranch,
};

jest.mock("../contexts/GitHubContext", () => ({
  useGitHub: () => mockGitHubState,
}));

jest.mock("../contexts/ProjectContext", () => ({
  useProject: () => ({
    projectData: mockProjectData,
    updateProjectFiles: jest.fn(async () => undefined),
    setLinkedRepo: jest.fn(),
  }),
}));

jest.mock("../hooks/useGitHubRepos", () => ({
  useGitHubRepos: () => ({
    repos: [],
    loading: false,
    error: null,
    loadRepos: jest.fn(async () => undefined),
    pullFromRepo: jest.fn(async () => []),
    loadBranches: jest.fn(async () => []),
    loadWorkflowRuns: jest.fn(async () => []),
    loadDefaultBranch: jest.fn(async () => "main"),
  }),
}));

jest.mock("../infra/github/user", () => ({
  getGitHubUser: jest.fn(async () => ({ login: "demo" })),
}));

jest.mock("../infra/github/githubService", () => ({
  getGitHubToken: jest.fn(async () => "ghp_test"),
  getRepoFileText: jest.fn(async () => "{}"),
  compareLocalFilesWithRepo: jest.fn(async () => ({ modified: 0, localOnly: 0, remoteOnly: 0, skipped: 0, error: 0 })),
}));

jest.mock("../lib/autoSyncRepoSecrets", () => ({
  autoSyncRepoSecrets: jest.fn(async () => ({ updated: [] })),
}));

jest.mock("../lib/repoSyncOrchestration", () => ({
  markRepoSyncSignature: jest.fn(async () => undefined),
}));

jest.mock("../screens/GitHubReposScreen/hooks/templateFiles", () => ({
  loadCoreTemplateFiles: jest.fn(() => []),
  getCoreFileContent: jest.fn(() => null),
  CORE_TEMPLATE_FILES: [],
}));

jest.mock("../screens/GitHubReposScreen/utils/easLinkContract", () => {
  const actual = jest.requireActual("../screens/GitHubReposScreen/utils/easLinkContract");
  return {
    ...actual,
    checkRepoEasLinkStatus: jest.fn(),
  };
});

describe("useGitHubReposScreen EAS status neutral reset", () => {
  const mockCheckRepoEasLinkStatus = jest.mocked(checkRepoEasLinkStatus);

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGitHubState.activeRepo = "owner/repo-a";
    mockGitHubState.activeBranch = "main";
    mockProjectData.linkedRepo = "owner/repo-a";
    mockProjectData.linkedBranch = "main";
    mockCheckRepoEasLinkStatus.mockResolvedValue(getEasLinkPresentation("verified", "current selection verified"));
  });

  it("shows a neutral unknown state instead of carrying verified across a branch change", async () => {
    const { result, rerender } = renderHook(() => useGitHubReposScreen(), {
      initialProps: undefined,
    });

    await act(async () => {
      await Promise.resolve();
      await result.current.handleEasLinkStatusCheck();
    });

    expect(result.current.easLinkStatus.state).toBe("verified");

    await act(async () => {
      mockGitHubState.activeBranch = "staging";
      rerender(undefined);
      await Promise.resolve();
    });

    expect(result.current.easLinkStatus.state).toBe("unknown");
    expect(result.current.easLinkStatus.label).not.toBe("Verifiziert");
    expect(result.current.easLinkStatus.detail).toMatch(/noch nicht geladen/i);
  });
});
