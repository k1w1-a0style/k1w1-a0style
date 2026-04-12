import type { GitHubRepo, WorkflowRun, GitHubBranch } from "../../../hooks/useGitHubRepos";
import type { ProjectFile, TemplateId } from "../../../shared/types/project";
import type { EasLinkPresentation } from "../utils/easLinkContract";
import type { PullPreviewState } from "./useGitHubReposPushPull";
import type { SyncStatus } from "./useGitHubReposSyncStatus";
import type { ManageModalConfig } from "./useGitHubRepoCrud";
import type { RepoFilterType } from "./templateFiles";
import type { PullApplyStrategy } from "../utils/pullApplySemantics";

export type UseGitHubReposScreenModel = {
  projectFiles: ProjectFile[];

  token: string | null;
  tokenLoading: boolean;
  tokenError: string | null;
  userLogin: string;
  userLoading: boolean;

  loadingRepos: boolean;
  reposError: string | null;
  loadRepos: () => Promise<void>;
  refreshing: boolean;
  handleRefresh: () => Promise<void>;
  combinedRepos: GitHubRepo[];
  filteredRepos: GitHubRepo[];

  activeRepo: string | null;
  activeRepoObj: GitHubRepo | null;
  activeBranch: string | null;
  recentRepos: string[];
  addRecentRepo: (repo: string) => void;
  clearRecentRepos: () => void;

  showRepoList: boolean;
  setShowRepoList: (next: boolean) => void;
  showNewRepo: boolean;
  setShowNewRepo: (next: boolean) => void;
  showRenameRepo: boolean;
  setShowRenameRepo: (next: boolean) => void;
  showAdvanced: boolean;
  setShowAdvanced: (next: boolean) => void;

  searchTerm: string;
  setSearchTerm: (next: string) => void;
  filterType: RepoFilterType;
  setFilterType: (next: RepoFilterType) => void;
  newRepoName: string;
  setNewRepoName: (next: string) => void;
  newRepoPrivate: boolean;
  setNewRepoPrivate: (next: boolean) => void;
  renameName: string;
  setRenameName: (next: string) => void;

  handleSelectRepo: (repoOrString: GitHubRepo | string) => void;
  handleSelectBranch: (branch: string) => void;
  handleCreateRepo: () => Promise<void>;
  isCreating: boolean;
  handleRenameRepo: () => Promise<void>;
  isRenaming: boolean;
  handleDeleteRepo: (repo: GitHubRepo) => Promise<void>;
  isDeletingRepo: boolean;
  handlePull: () => Promise<void>;
  isPulling: boolean;
  pullProgress: string;
  handlePush: () => Promise<void>;
  isPushing: boolean;
  openPushModalForPaths: (paths: string[]) => void;
  handleOpenRepoOnGitHub: () => Promise<void>;
  handleSyncSecrets: () => Promise<void>;
  isSyncingSecrets: boolean;

  pushModalVisible: boolean;
  setPushModalVisible: (next: boolean) => void;
  pushCommitMessage: string;
  setPushCommitMessage: (next: string) => void;
  pushSelectedPaths: Record<string, boolean>;
  togglePushPath: (path: string) => void;
  setAllPushPaths: (on: boolean) => void;
  closePushModal: () => void;
  confirmPushSelected: () => Promise<void>;

  pullModalVisible: boolean;
  pullPreviewLoading: boolean;
  pullPreview: PullPreviewState | null;
  closePullModal: () => void;
  applyPulledFiles: (strategy: PullApplyStrategy) => Promise<void>;

  syncStatus: SyncStatus;
  refreshSyncStatus: () => Promise<void>;

  easProjectId: string;
  setEasProjectId: (next: string) => void;
  isEasLinking: boolean;
  easLinkStatus: EasLinkPresentation;
  handleEasLinkStatusCheck: () => Promise<EasLinkPresentation | null>;
  handleEasLink: () => Promise<void>;

  loadBranches: (owner: string, repo: string) => Promise<GitHubBranch[]>;
  loadDefaultBranch: (owner: string, repo: string) => Promise<string>;
  loadWorkflowRuns: (owner: string, repo: string, perPage?: number) => Promise<WorkflowRun[]>;

  handleCreateBranch: () => void;
  handleRenameBranch: () => void;
  handleDeleteBranch: () => void;

  manageModal: ManageModalConfig | null;
  manageValue: string;
  manageBusy: boolean;
  setManageValue: (v: string) => void;
  closeManageModal: () => void;
  confirmManageModal: () => Promise<void>;
};

export type { TemplateId };
