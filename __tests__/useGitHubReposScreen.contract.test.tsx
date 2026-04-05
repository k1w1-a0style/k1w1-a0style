import { renderHook } from "@testing-library/react-native";

import { useGitHubReposScreen } from "../screens/GitHubReposScreen/hooks/useGitHubReposScreen";
import { getEasLinkPresentation } from "../screens/GitHubReposScreen/utils/easLinkContract";

jest.mock("../contexts/GitHubContext", () => ({
  useGitHub: () => ({
    activeRepo: "owner/repo",
    activeBranch: "main",
    recentRepos: ["owner/repo"],
    addRecentRepo: jest.fn(),
    clearRecentRepos: jest.fn(),
  }),
}));

jest.mock("../contexts/ProjectContext", () => ({
  useProject: () => ({
    projectData: { files: [], templateId: "auto" },
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

jest.mock("../infra/github/githubService", () => ({
  getGitHubToken: jest.fn(async () => "ghp_test"),
  compareLocalFilesWithRepo: jest.fn(async () => ({ modified: 0, localOnly: 0, remoteOnly: 0, skipped: 0, error: 0 })),
  pushFilesToRepoAdvanced: jest.fn(async () => undefined),
  getRepoFileText: jest.fn(async () => "{}"),
  createOrUpdateFile: jest.fn(async () => undefined),
}));

jest.mock("../infra/github/user", () => ({
  getGitHubUser: jest.fn(async () => ({ login: "operator" })),
}));

jest.mock("../lib/repoSyncOrchestration", () => ({
  markRepoSyncSignature: jest.fn(async () => undefined),
}));

jest.mock("../lib/autoSyncRepoSecrets", () => ({
  autoSyncRepoSecrets: jest.fn(async () => ({ updated: [] })),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => "11111111-1111-1111-1111-111111111111"),
    setItem: jest.fn(async () => undefined),
  },
}));

describe("useGitHubReposScreen contract", () => {
  it("returns stable operational surface for the screen", () => {
    const { result } = renderHook(() => useGitHubReposScreen());

    expect(result.current).toEqual(
      expect.objectContaining({
        tokenLoading: expect.any(Boolean),
        activeRepo: expect.any(String),
        activeBranch: expect.any(String),
        handleSelectRepo: expect.any(Function),
        handlePull: expect.any(Function),
        handlePush: expect.any(Function),
        handleEasLinkStatusCheck: expect.any(Function),
        handleEasLink: expect.any(Function),
        syncStatus: expect.objectContaining({ checking: expect.any(Boolean) }),
      }),
    );

    expect(result.current.easLinkStatus.state).toBe(getEasLinkPresentation("unknown").state);
  });
});
