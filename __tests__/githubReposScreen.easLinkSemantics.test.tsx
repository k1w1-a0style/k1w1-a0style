import React from "react";
import { render } from "@testing-library/react-native";

import GitHubReposScreen from "../screens/GitHubReposScreen";
import { getEasLinkPresentation } from "../screens/GitHubReposScreen/utils/easLinkContract";

jest.mock("../screens/GitHubReposScreen/components/HeaderSection", () => ({
  HeaderSection: () => null,
}));
jest.mock("../screens/GitHubReposScreen/components/TokenStatusSection", () => ({
  TokenStatusSection: () => null,
}));
jest.mock("../screens/GitHubReposScreen/components/NewRepoSection", () => ({
  NewRepoSection: () => null,
}));
jest.mock("../screens/GitHubReposScreen/components/RenameRepoSection", () => ({
  RenameRepoSection: () => null,
}));
jest.mock("../screens/GitHubReposScreen/components/BranchSelector", () => ({
  BranchSelector: () => null,
}));
jest.mock("../screens/GitHubReposScreen/components/RepoMetaSection", () => ({
  RepoMetaSection: () => null,
}));
jest.mock("../screens/GitHubReposScreen/components/SecretsSection", () => ({
  SecretsSection: () => null,
}));
jest.mock("../screens/GitHubReposScreen/components/RepoSyncSection", () => ({
  RepoSyncSection: () => null,
}));
jest.mock("../screens/GitHubReposScreen/components/ManageTextModal", () => ({
  ManageTextModal: () => null,
}));
jest.mock("../screens/GitHubReposScreen/components/LocalRemoteDiffSection", () => ({
  LocalRemoteDiffSection: () => null,
}));
jest.mock("../screens/GitHubReposScreen/components/PushOptionsModal", () => ({
  PushOptionsModal: () => null,
}));
jest.mock("../screens/GitHubReposScreen/components/PullPreviewModal", () => ({
  PullPreviewModal: () => null,
}));
jest.mock("../components/RepoListItem", () => ({
  RepoListItem: () => null,
}));

const mockUseGitHubReposScreen = jest.fn();
jest.mock("../screens/GitHubReposScreen/hooks/useGitHubReposScreen", () => ({
  useGitHubReposScreen: () => mockUseGitHubReposScreen(),
}));

const baseVM = (status = getEasLinkPresentation("verified")) => ({
  token: "ghp_test",
  tokenLoading: false,
  tokenError: "",
  userLogin: "demo",
  loadingRepos: false,
  reposError: "",
  refreshing: false,
  handleRefresh: jest.fn(),
  activeRepo: "owner/repo",
  activeBranch: "main",
  projectFiles: [],
  showRepoList: false,
  showNewRepo: false,
  setShowNewRepo: jest.fn(),
  showRenameRepo: false,
  setShowRenameRepo: jest.fn(),
  handleSelectRepo: jest.fn(),
  filteredRepos: [],
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
  handleOpenRepoOnGitHub: jest.fn(),
  loadBranches: jest.fn(),
  loadDefaultBranch: jest.fn(),
  handleSelectBranch: jest.fn(),
  handlePull: jest.fn(),
  isPulling: false,
  pullProgress: "",
  handlePush: jest.fn(),
  isPushing: false,
  pushModalVisible: false,
  pushCommitMessage: "",
  setPushCommitMessage: jest.fn(),
  pushSelectedPaths: {},
  togglePushPath: jest.fn(),
  setAllPushPaths: jest.fn(),
  closePushModal: jest.fn(),
  confirmPushSelected: jest.fn(),
  pullModalVisible: false,
  pullPreviewLoading: false,
  pullPreview: null,
  closePullModal: jest.fn(),
  applyPulledFiles: jest.fn(),
  syncStatus: { checking: false, modified: 0, localOnly: 0, remoteOnly: 0, skipped: 0, error: 0, checkedAt: null },
  refreshSyncStatus: jest.fn(),
  handleCreateBranch: jest.fn(),
  handleRenameBranch: jest.fn(),
  handleDeleteBranch: jest.fn(),
  manageModal: null,
  manageValue: "",
  manageBusy: false,
  setManageValue: jest.fn(),
  closeManageModal: jest.fn(),
  confirmManageModal: jest.fn(),
  easProjectId: "11111111-1111-1111-1111-111111111111",
  setEasProjectId: jest.fn(),
  isEasLinking: false,
  easLinkStatus: status,
  handleEasLinkStatusCheck: jest.fn(async () => status),
  handleEasLink: jest.fn(),
});

describe("GitHubReposScreen EAS link UI semantics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not render mismatch, workflow missing and auth states as normal verified OK", () => {
    mockUseGitHubReposScreen.mockReturnValue(
      baseVM(getEasLinkPresentation("project_mismatch", "Repo verweist auf eine andere EAS Project ID als erwartet.")),
    );
    const mismatch = render(<GitHubReposScreen />);
    expect(mismatch.getByText("ID mismatch")).toBeTruthy();
    expect(mismatch.getByText(/andere EAS Project ID/i)).toBeTruthy();
    expect(mismatch.queryByText("Verifiziert")).toBeNull();

    mockUseGitHubReposScreen.mockReturnValue(
      baseVM(getEasLinkPresentation("workflow_missing", "Workflow fehlt. Projektdatei passt bereits, aber der Workflow fehlt.")),
    );
    const workflowMissing = render(<GitHubReposScreen />);
    expect(workflowMissing.getByText("Workflow fehlt")).toBeTruthy();
    expect(workflowMissing.getByText(/Projektdatei passt bereits/i)).toBeTruthy();
    expect(workflowMissing.queryByText("Verifiziert")).toBeNull();

    mockUseGitHubReposScreen.mockReturnValue(
      baseVM(getEasLinkPresentation("auth_error", "Repo-Inhalt konnte mit diesem GitHub-Zugriff nicht sicher geprueft werden.")),
    );
    const auth = render(<GitHubReposScreen />);
    expect(auth.getByText("Zugriff unklar")).toBeTruthy();
    expect(auth.getByText(/nicht sicher geprueft/i)).toBeTruthy();
    expect(auth.queryByText("Verifiziert")).toBeNull();
  });

  it("keeps a real verified EAS link as verified success copy", () => {
    mockUseGitHubReposScreen.mockReturnValue(
      baseVM(getEasLinkPresentation("verified", "Workflow vorhanden und EAS Project ID stimmt mit der erwarteten ID ueberein.")),
    );

    const screen = render(<GitHubReposScreen />);
    expect(screen.getByText("Verifiziert")).toBeTruthy();
    expect(screen.getByText(/stimmt mit der erwarteten ID ueberein/i)).toBeTruthy();
  });
});
