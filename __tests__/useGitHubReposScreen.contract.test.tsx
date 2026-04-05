import { renderHook } from "@testing-library/react-native";

import { useGitHubReposScreen } from "../screens/GitHubReposScreen/hooks/useGitHubReposScreen";

const mockUnknownEasLinkStatus = {
  state: "unknown",
  color: "#888",
  icon: "help-circle-outline",
  label: "Unbekannt",
  detail: "",
};

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

jest.mock("../screens/GitHubReposScreen/hooks/useGitHubRepoCrud", () => ({
  useGitHubRepoCrud: () => ({
    localRepos: [],
    isCreating: false,
    isRenaming: false,
    isDeletingRepo: false,
    handleCreateRepo: jest.fn(async () => undefined),
    handleRenameRepo: jest.fn(async () => undefined),
    handleDeleteRepo: jest.fn(async () => undefined),
    handleCreateBranch: jest.fn(),
    handleRenameBranch: jest.fn(),
    handleDeleteBranch: jest.fn(),
    manageModal: null,
    manageValue: "",
    manageBusy: false,
    setManageValue: jest.fn(),
    closeManageModal: jest.fn(),
    confirmManageModal: jest.fn(async () => undefined),
  }),
}));

jest.mock("../screens/GitHubReposScreen/hooks/useGitHubReposScreenBootstrap", () => ({
  useGitHubReposScreenBootstrap: () => ({
    token: "ghp_test",
    tokenLoading: false,
    tokenError: null,
    userLogin: "operator",
    userLoading: false,
    easProjectId: "11111111-1111-1111-1111-111111111111",
    setEasProjectId: jest.fn(),
  }),
}));

jest.mock("../screens/GitHubReposScreen/hooks/useGitHubReposScreenUiState", () => ({
  useGitHubReposScreenUiState: () => ({
    showRepoList: true,
    setShowRepoList: jest.fn(),
    showNewRepo: false,
    setShowNewRepo: jest.fn(),
    showRenameRepo: false,
    setShowRenameRepo: jest.fn(),
    showAdvanced: false,
    setShowAdvanced: jest.fn(),
    searchTerm: "",
    setSearchTerm: jest.fn(),
    filterType: "all",
    setFilterType: jest.fn(),
    newRepoName: "",
    setNewRepoName: jest.fn(),
    newRepoPrivate: true,
    setNewRepoPrivate: jest.fn(),
    renameName: "",
    setRenameName: jest.fn(),
    isSyncingSecrets: false,
    handleSyncSecrets: jest.fn(async () => undefined),
  }),
}));

jest.mock("../screens/GitHubReposScreen/hooks/useGitHubReposSelection", () => ({
  useGitHubReposSelection: () => ({
    handleSelectRepo: jest.fn(),
    handleSelectBranch: jest.fn(),
  }),
}));

jest.mock("../screens/GitHubReposScreen/hooks/useGitHubReposSyncStatus", () => ({
  useGitHubReposSyncStatus: () => ({
    syncStatus: { checking: false, modified: 0, localOnly: 0, remoteOnly: 0, skipped: 0, error: 0, checkedAt: null },
    refreshSyncStatus: jest.fn(async () => undefined),
  }),
}));

jest.mock("../screens/GitHubReposScreen/hooks/useGitHubReposPushPull", () => ({
  useGitHubReposPushPull: () => ({
    isPulling: false,
    isPushing: false,
    pullProgress: "",
    resetPullProgress: jest.fn(),
    pushModalVisible: false,
    setPushModalVisible: jest.fn(),
    pushCommitMessage: "chore: sync",
    setPushCommitMessage: jest.fn(),
    pushSelectedPaths: {},
    togglePushPath: jest.fn(),
    setAllPushPaths: jest.fn(),
    closePushModal: jest.fn(),
    handlePush: jest.fn(async () => undefined),
    openPushModalForPaths: jest.fn(),
    confirmPushSelected: jest.fn(async () => undefined),
    pullModalVisible: false,
    pullPreviewLoading: false,
    pullPreview: null,
    closePullModal: jest.fn(),
    handlePull: jest.fn(async () => undefined),
    applyPulledFiles: jest.fn(async () => undefined),
  }),
}));

jest.mock("../screens/GitHubReposScreen/hooks/useGitHubReposEasLink", () => ({
  useGitHubReposEasLink: () => ({
    isEasLinking: false,
    easLinkStatus: mockUnknownEasLinkStatus,
    handleEasLinkStatusCheck: jest.fn(async () => mockUnknownEasLinkStatus),
    handleEasLink: jest.fn(async () => undefined),
  }),
}));

jest.mock("../screens/GitHubReposScreen/hooks/useGitHubReposDerivedState", () => ({
  useGitHubReposDerivedState: () => ({
    combinedRepos: [],
    activeRepoObj: null,
    filteredRepos: [],
    workflowRuns: jest.fn(async () => []),
  }),
}));

describe("useGitHubReposScreen contract", () => {
  it("returns stable operational surface for the screen", () => {
    const { result } = renderHook(() => useGitHubReposScreen());

    expect(result.current).toEqual(
      expect.objectContaining({
        tokenLoading: false,
        activeRepo: "owner/repo",
        activeBranch: "main",
        handleSelectRepo: expect.any(Function),
        handlePull: expect.any(Function),
        handlePush: expect.any(Function),
        handleEasLinkStatusCheck: expect.any(Function),
        handleEasLink: expect.any(Function),
        syncStatus: expect.objectContaining({ checking: false }),
      }),
    );

    expect(result.current.easLinkStatus.state).toBe("unknown");
  });
});
