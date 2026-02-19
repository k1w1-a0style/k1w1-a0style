import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

import GitHubReposScreen from "../screens/GitHubReposScreen";

jest.mock("../screens/GitHubReposScreen/components/HeaderSection", () => ({
  HeaderSection: () => null,
}));
jest.mock("../screens/GitHubReposScreen/components/TokenStatusSection", () => ({
  TokenStatusSection: () => null,
}));
// These components were removed as part of cleanup patches, but older tests
// still mock them. Mark as `virtual` so Jest won't try to resolve files.
jest.mock(
  "../screens/GitHubReposScreen/components/ActionsSection",
  () => ({ ActionsSection: () => null }),
  { virtual: true },
);
jest.mock("../screens/GitHubReposScreen/components/NewRepoSection", () => ({
  NewRepoSection: () => null,
}));
jest.mock("../screens/GitHubReposScreen/components/RenameRepoSection", () => ({
  RenameRepoSection: () => null,
}));
jest.mock("../screens/GitHubReposScreen/components/BranchSelector", () => ({
  BranchSelector: () => null,
}));
jest.mock(
  "../screens/GitHubReposScreen/components/WorkflowRunsSection",
  () => ({ WorkflowRunsSection: () => null }),
  { virtual: true },
);

jest.mock("../screens/GitHubReposScreen/components/FilterSection", () => {
  const React = require("react");
  const { Text, TouchableOpacity } = require("react-native");
  return {
    FilterSection: ({ recentRepos, onSelectRecentRepo }: any) => {
      // minimal stub: render 1 recent pill if provided
      if (!recentRepos?.length) return null;
      return (
        <TouchableOpacity testID="recent-pill" onPress={() => onSelectRecentRepo(recentRepos[0])}>
          <Text>{recentRepos[0]}</Text>
        </TouchableOpacity>
      );
    },
  };
});

jest.mock("../components/RepoListItem", () => {
  const React = require("react");
  const { Text, TouchableOpacity } = require("react-native");
  return {
    RepoListItem: ({ repo, onPress }: any) => (
      <TouchableOpacity testID={`repo-${repo.full_name}`} onPress={() => onPress(repo)}>
        <Text>{repo.full_name}</Text>
      </TouchableOpacity>
    ),
  };
});

// NOTE: Jest forbids referencing out-of-scope vars inside jest.mock() factories
// unless the identifier is prefixed with "mock". Keep this name.
const mockUseGitHubReposScreen = jest.fn();
jest.mock("../screens/GitHubReposScreen/hooks/useGitHubReposScreen", () => ({
  useGitHubReposScreen: () => mockUseGitHubReposScreen(),
}));

const baseVM = (overrides: any = {}) => ({
  token: "ghp_test",
  tokenLoading: false,
  tokenError: "",

  loadingRepos: false,
  loadRepos: jest.fn(),
  refreshing: false,
  handleRefresh: jest.fn(),

  activeRepo: null,
  activeBranch: null,

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

  recentRepos: [],
  clearRecentRepos: jest.fn(),

  filteredRepos: [],
  handleSelectRepo: jest.fn(),
  handleDeleteRepo: jest.fn(),

  newRepoName: "",
  setNewRepoName: jest.fn(),
  newRepoPrivate: true,
  setNewRepoPrivate: jest.fn(),
  isCreating: false,
  handleCreateRepo: jest.fn(),

  renameName: "",
  setRenameName: jest.fn(),
  isRenaming: false,
  handleRenameRepo: jest.fn(),

  isPushing: false,
  handlePush: jest.fn(),
  isPulling: false,
  handlePull: jest.fn(),
  pullProgress: null,

  isSyncingSecrets: false,
  handleSyncSecrets: jest.fn(),

  handleOpenRepoOnGitHub: jest.fn(),

  loadBranches: jest.fn(),
  loadDefaultBranch: jest.fn(),
  handleSelectBranch: jest.fn(),

  manageModal: null,
  manageValue: "",
  setManageValue: jest.fn(),
  closeManageModal: jest.fn(),

  handleCreateBranch: jest.fn(),
  handleRenameBranch: jest.fn(),
  handleDeleteBranch: jest.fn(),

  loadWorkflowRuns: jest.fn(),

  ...overrides,
});

describe("GitHubReposScreen repo list", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders FlatList and empty state when repo list is enabled but empty", () => {
    mockUseGitHubReposScreen.mockReturnValue(
      baseVM({ showRepoList: true, filteredRepos: [], loadingRepos: false }),
    );

    const { getByTestId, getByText } = render(<GitHubReposScreen />);
    expect(getByTestId("github-repos-flatlist")).toBeTruthy();
    expect(getByText("Keine Repositories")).toBeTruthy();
  });

  test("does not render repo items when repo list is hidden", () => {
    const repos = [
      { id: 1, name: "a", full_name: "x/a", description: "", updated_at: new Date().toISOString() },
    ];
    mockUseGitHubReposScreen.mockReturnValue(
      baseVM({ showRepoList: false, filteredRepos: repos }),
    );

    const { queryByTestId } = render(<GitHubReposScreen />);
    expect(queryByTestId("repo-x/a")).toBeNull();
  });

  test("pressing a repo item calls handleSelectRepo with the repo", () => {
    const repos = [
      { id: 1, name: "a", full_name: "x/a", description: "", updated_at: new Date().toISOString() },
      { id: 2, name: "b", full_name: "x/b", description: "", updated_at: new Date().toISOString() },
    ];
    const handleSelectRepo = jest.fn();

    mockUseGitHubReposScreen.mockReturnValue(
      baseVM({ showRepoList: true, filteredRepos: repos, handleSelectRepo }),
    );

    const { getByTestId } = render(<GitHubReposScreen />);
    fireEvent.press(getByTestId("repo-x/b"));
    expect(handleSelectRepo).toHaveBeenCalledTimes(1);
    expect(handleSelectRepo).toHaveBeenCalledWith(repos[1]);
  });
});
