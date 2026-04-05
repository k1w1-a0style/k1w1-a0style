// screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts
// REFACTORED: template data → templateFiles.ts

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../../../lib/storageKeys";
import { useGitHub } from "../../../contexts/GitHubContext";
import { useProject } from "../../../contexts/ProjectContext";
import { getGitHubToken } from "../../../infra/github/githubService";
import { getGitHubUser } from "../../../infra/github/user";
import { autoSyncRepoSecrets } from "../../../lib/autoSyncRepoSecrets";
import { useGitHubRepos, WorkflowRun } from "../../../hooks/useGitHubRepos";
import { combineRepos } from "../utils/repos";
import { normalizeProjectFiles } from "../utils/projectFiles";
import { runTemplateHardChecklist, resolveEffectiveTemplateId } from "../../../lib/diagnostics/templates";
import type { TemplateId, CoreTemplateId, ProjectFile } from "../../../shared/types/project";

import { getCoreFileContent, CORE_TEMPLATE_FILES } from "./templateFiles";
import type { RepoFilterType } from "./templateFiles";
import { getErrorMessage } from "./githubReposScreenErrorHelpers";
import { getSecretsSyncNotice } from "./githubReposScreenNoticeHelpers";
import { useGitHubRepoCrud } from "./useGitHubRepoCrud";
import { useGitHubReposSelection } from "./useGitHubReposSelection";
import { useGitHubReposEasLink } from "./useGitHubReposEasLink";
import { useGitHubReposSyncStatus } from "./useGitHubReposSyncStatus";
import { useGitHubReposPushPull } from "./useGitHubReposPushPull";

export function useGitHubReposScreen() {
  const {
    activeRepo,
    activeBranch,
    recentRepos,
    addRecentRepo,
    clearRecentRepos,
  } = useGitHub();

  const { projectData, updateProjectFiles, setLinkedRepo } = useProject();

  // Local project files are the source of truth for what exists "locally" inside the app.
  // Expose them so the RepoScreen can show local↔remote diffs and wire push/pull UX.
  const normalizedLocalFiles = useMemo<ProjectFile[]>(
    () => normalizeProjectFiles(projectData?.files),
    [projectData?.files],
  );

  const projectFiles = normalizedLocalFiles;

  const templateId: TemplateId = ((projectData?.templateId as TemplateId) || "auto");
  const effectiveTemplateId: CoreTemplateId =
    resolveEffectiveTemplateId(templateId, normalizedLocalFiles).effective;

  const [token, setToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [userLogin, setUserLogin] = useState<string>("" );
  const [userLoading, setUserLoading] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const hasAutoLoaded = useRef(false);

  const isMountedRef = useRef(true);
  const refreshGen = useRef(0);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [showRepoList, setShowRepoList] = useState(true);
  const [showNewRepo, setShowNewRepo] = useState(false);
  const [showRenameRepo, setShowRenameRepo] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<RepoFilterType>("all");

  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);
  const [renameName, setRenameName] = useState("");

  const [isSyncingSecrets, setIsSyncingSecrets] = useState(false);

  const [easProjectId, setEasProjectId] = useState<string>("");

  const {
    repos,
    loading: loadingRepos,
    error: reposError,
    loadRepos,
    pullFromRepo,
    loadBranches,
    loadWorkflowRuns,
    loadDefaultBranch,
  } = useGitHubRepos(token);

  const { syncStatus, refreshSyncStatus } = useGitHubReposSyncStatus({
    activeRepo,
    activeBranch,
    normalizedLocalFiles,
    isMountedRef,
  });

  // Token load
  useEffect(() => {
    let mounted = true;
    (async () => {
      setTokenLoading(true);
      setTokenError(null);
      try {
        const t = await getGitHubToken();
        if (!mounted) return;
        setToken(t);
        if (!t) {
          setTokenError("Kein Token gefunden. Hinterlege eins im Verbindungen-Screen.");
        }
      } catch (e: unknown) {
        if (!mounted) return;
        setToken(null);
        setTokenError(getErrorMessage(e, "Token konnte nicht geladen werden."));
      } finally {
        if (mounted) setTokenLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // User info (best-effort)
  useEffect(() => {
    let mounted = true;
    if (!token) {
      setUserLogin("");
      return () => { mounted = false; };
    }
    setUserLoading(true);
    getGitHubUser()
      .then((u) => {
        if (!mounted) return;
        setUserLogin(String(u?.login || "").trim());
      })
      .catch(() => {
        if (!mounted) return;
        setUserLogin("");
      })
      .finally(() => {
        if (mounted) setUserLoading(false);
      });
    return () => { mounted = false; };
  }, [token]);

  // Load EAS project ID
  useEffect(() => {
    let mounted = true;
    (async () => {
      const id = await AsyncStorage.getItem(STORAGE_KEYS.EAS_PROJECT_ID).catch(() => "");
      if (!mounted) return;
      setEasProjectId((id || "").trim());
    })();
    return () => { mounted = false; };
  }, []);

  // Auto-load repos once token exists
  useEffect(() => {
    if (!token || hasAutoLoaded.current) return;
    hasAutoLoaded.current = true;
    loadRepos();
  }, [token, loadRepos]);

  const handleRefresh = useCallback(async () => {
    if (!token) return;

    const gen = ++refreshGen.current;
    if (isMountedRef.current) setRefreshing(true);

    try {
      await loadRepos();
    } finally {
      if (!isMountedRef.current) return;
      if (gen !== refreshGen.current) return; // newer refresh took over
      setRefreshing(false);
    }
  }, [token, loadRepos]);

  const {
    localRepos,
    isCreating,
    isRenaming,
    isDeletingRepo,
    handleCreateRepo,
    handleRenameRepo,
    handleDeleteRepo,
    handleCreateBranch,
    handleRenameBranch,
    handleDeleteBranch,
    manageModal,
    manageValue,
    manageBusy,
    setManageValue,
    closeManageModal,
    confirmManageModal,
  } = useGitHubRepoCrud({
    token,
    activeRepo,
    activeBranch,
    renameName,
    newRepoName,
    newRepoPrivate,
    addRecentRepo,
    setLinkedRepo,
    loadRepos,
    loadDefaultBranch,
    setShowRenameRepo,
    setShowNewRepo,
    setRenameName,
    setNewRepoName,
  });

  const withCoreFiles = useCallback((files: ProjectFile[]): ProjectFile[] => {
    // Ensure core workflow files exist and are valid. Only applies for core templates.
    const mapped = (files ?? []).map((f) => ({
      path: String(f.path),
      content: typeof f.content === "string" ? f.content : JSON.stringify(f.content ?? "", null, 2),
    }));

    const checked = runTemplateHardChecklist(
      mapped.map((f) => ({ path: f.path, content: f.content })),
      { autofix: true },
    );

    const fileMap = new Map<string, string>();
    checked.files.forEach((f) => fileMap.set(f.path, f.content));

    // Ensure required core files exist (if missing)
    for (const corePath of CORE_TEMPLATE_FILES) {
      if (!fileMap.has(corePath)) {
        const content = getCoreFileContent(corePath, effectiveTemplateId);
        if (content != null) fileMap.set(corePath, content);
      }
    }

    return Array.from(fileMap.entries()).map(([path, content]) => ({ path, content }));
  }, [effectiveTemplateId]);

  const {
    isPulling,
    isPushing,
    pullProgress,
    resetPullProgress,
    pushModalVisible,
    setPushModalVisible,
    pushCommitMessage,
    setPushCommitMessage,
    pushSelectedPaths,
    togglePushPath,
    setAllPushPaths,
    closePushModal,
    handlePush,
    openPushModalForPaths,
    confirmPushSelected,
    pullModalVisible,
    pullPreviewLoading,
    pullPreview,
    closePullModal,
    handlePull,
    applyPulledFiles,
  } = useGitHubReposPushPull({
    activeRepo,
    activeBranch,
    normalizedLocalFiles,
    updateProjectFiles,
    refreshSyncStatus,
    pullFromRepo,
    withCoreFiles,
  });

  const { handleSelectRepo, handleSelectBranch } = useGitHubReposSelection({
    activeRepo,
    addRecentRepo,
    setLinkedRepo,
    loadDefaultBranch,
    isMountedRef,
    setShowRenameRepo,
    setShowNewRepo,
    setPullProgress: resetPullProgress,
  });

  const handleOpenRepoOnGitHub = useCallback(async () => {
    if (!activeRepo) return;
    await Linking.openURL(`https://github.com/${activeRepo}`);
  }, [activeRepo]);

  const {
    isEasLinking,
    easLinkStatus,
    handleEasLinkStatusCheck,
    handleEasLink,
  } = useGitHubReposEasLink({
    activeRepo,
    activeBranch,
    easProjectId,
    isMountedRef,
  });

  const handleSyncSecrets = useCallback(async () => {
    if (!activeRepo) {
      Alert.alert("⚠️", "Kein Repo ausgewählt.");
      return;
    }
    setIsSyncingSecrets(true);
    try {
      const result = await autoSyncRepoSecrets(activeRepo);
      const syncNotice = getSecretsSyncNotice(result.updated);
      Alert.alert(syncNotice.title, syncNotice.message);
    } catch (e: unknown) {
      Alert.alert("❌ Secrets Sync fehlgeschlagen", getErrorMessage(e, ""));
    } finally {
      setIsSyncingSecrets(false);
    }
  }, [activeRepo]);

  const combinedRepos = useMemo(() => combineRepos(repos, localRepos), [repos, localRepos]);

  const activeRepoObj = useMemo(() => {
    if (!activeRepo) return null;
    return combinedRepos.find((r) => r.full_name === activeRepo) ?? null;
  }, [activeRepo, combinedRepos]);

  const filteredRepos = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let list = combinedRepos;

    if (filterType === "activeOnly" && activeRepo) {
      list = list.filter((r) => r.full_name === activeRepo);
    }
    if (filterType === "recentOnly") {
      list = list.filter((r) => recentRepos.includes(r.full_name));
    }

    if (term) {
      list = list.filter((r) => r.full_name.toLowerCase().includes(term));
    }
    return list;
  }, [combinedRepos, searchTerm, filterType, activeRepo, recentRepos]);

  const workflowRuns = useCallback(async (owner: string, repo: string, perPage?: number): Promise<WorkflowRun[]> => {
    return loadWorkflowRuns(owner, repo, perPage);
  }, [loadWorkflowRuns]);

  return {
    // local project
    projectFiles,

    // token
    token, tokenLoading, tokenError,
    userLogin, userLoading,

    // repos
    loadingRepos, reposError, loadRepos, refreshing, handleRefresh,
    combinedRepos, filteredRepos,

    // selection + recent
    activeRepo,
    activeRepoObj,
    activeBranch,
    recentRepos, addRecentRepo, clearRecentRepos,

    // UI states
    showRepoList, setShowRepoList,
    showNewRepo, setShowNewRepo,
    showRenameRepo, setShowRenameRepo,
    showAdvanced, setShowAdvanced,

    // filters + form states
    searchTerm, setSearchTerm,
    filterType, setFilterType,
    newRepoName, setNewRepoName,
    newRepoPrivate, setNewRepoPrivate,
    renameName, setRenameName,

    // ops
    handleSelectRepo, handleSelectBranch,
    handleCreateRepo, isCreating,
    handleRenameRepo, isRenaming,
    handleDeleteRepo, isDeletingRepo,
    handlePull, isPulling, pullProgress,
    handlePush, isPushing,
    openPushModalForPaths,
    // advanced sync UI
    pushModalVisible,
    setPushModalVisible,
    pushCommitMessage,
    setPushCommitMessage,
    pushSelectedPaths,
    togglePushPath,
    setAllPushPaths,
    closePushModal,
    confirmPushSelected,

    pullModalVisible,
    pullPreviewLoading,
    pullPreview,
    closePullModal,
    applyPulledFiles,

    syncStatus,
    refreshSyncStatus,
    handleOpenRepoOnGitHub,
    handleSyncSecrets, isSyncingSecrets,

    // eas link
    easProjectId, setEasProjectId,
    isEasLinking,
    easLinkStatus,
    handleEasLinkStatusCheck,
    handleEasLink,

    // github api helpers
    loadBranches,
    loadDefaultBranch,
    loadWorkflowRuns: workflowRuns,

    // branch ops
    handleCreateBranch,
    handleRenameBranch,
    handleDeleteBranch,

    // manage modal
    manageModal,
    manageValue,
    manageBusy,
    setManageValue,
    closeManageModal,
    confirmManageModal,
  };
}
