// screens/GitHubReposScreen/hooks/useGitHubReposScreen.ts
// REFACTORED: template data → templateFiles.ts

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useGitHub } from "../../../contexts/GitHubContext";
import { useProject } from "../../../contexts/ProjectContext";
import { useGitHubRepos } from "../../../hooks/useGitHubRepos";
import { normalizeProjectFiles } from "../utils/projectFiles";
import { runTemplateHardChecklist, resolveEffectiveTemplateId } from "../../../lib/diagnostics/templates";
import type { TemplateId, CoreTemplateId, ProjectFile } from "../../../shared/types/project";
import { getMaterializedProjectFiles } from "../../../lib/getMaterializedProjectFiles";

import { getCoreFileContent, CORE_TEMPLATE_FILES } from "./templateFiles";
import { useGitHubRepoCrud } from "./useGitHubRepoCrud";
import { useGitHubReposSelection } from "./useGitHubReposSelection";
import { useGitHubReposEasLink } from "./useGitHubReposEasLink";
import { useGitHubReposSyncStatus } from "./useGitHubReposSyncStatus";
import { useGitHubReposPushPull } from "./useGitHubReposPushPull";
import { useGitHubReposDerivedState } from "./useGitHubReposDerivedState";
import { useGitHubReposScreenBootstrap } from "./useGitHubReposScreenBootstrap";
import { useGitHubReposScreenUiState } from "./useGitHubReposScreenUiState";
import { buildGitHubReposScreenReturnModel } from "./useGitHubReposScreenReturnModel";
import type { UseGitHubReposScreenModel } from "./useGitHubReposScreen.model";

export function useGitHubReposScreen(): UseGitHubReposScreenModel {
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
    () => normalizeProjectFiles(getMaterializedProjectFiles(projectData)),
    [projectData],
  );

  const projectFiles = normalizedLocalFiles;

  const templateId: TemplateId = ((projectData?.templateId as TemplateId) || "auto");
  const effectiveTemplateId: CoreTemplateId =
    resolveEffectiveTemplateId(templateId, normalizedLocalFiles).effective;

  const [refreshing, setRefreshing] = useState(false);
  const hasAutoLoaded = useRef(false);
  const lastAutoLoadedTokenRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const refreshGen = useRef(0);

  const {
    token,
    tokenLoading,
    tokenError,
    userLogin,
    userLoading,
    easProjectId,
    setEasProjectId,
    refreshBootstrapState,
  } = useGitHubReposScreenBootstrap(activeRepo || projectData?.linkedRepo || null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const {
    showRepoList,
    setShowRepoList,
    showNewRepo,
    setShowNewRepo,
    showRenameRepo,
    setShowRenameRepo,
    showAdvanced,
    setShowAdvanced,
    searchTerm,
    setSearchTerm,
    filterType,
    setFilterType,
    newRepoName,
    setNewRepoName,
    newRepoPrivate,
    setNewRepoPrivate,
    renameName,
    setRenameName,
    isSyncingSecrets,
    handleSyncSecrets,
  } = useGitHubReposScreenUiState({ activeRepo });

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

  // Auto-load repos once token exists
  useEffect(() => {
    if (!token) {
      hasAutoLoaded.current = false;
      lastAutoLoadedTokenRef.current = null;
      return;
    }
    if (hasAutoLoaded.current && lastAutoLoadedTokenRef.current === token) return;
    hasAutoLoaded.current = true;
    lastAutoLoadedTokenRef.current = token;
    loadRepos();
  }, [token, loadRepos]);

  useFocusEffect(
    useCallback(() => {
      void refreshBootstrapState();
      if (token) {
        void loadRepos();
      }
      return undefined;
    }, [token, loadRepos, refreshBootstrapState]),
  );

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

  const { combinedRepos, activeRepoObj, filteredRepos, workflowRuns } = useGitHubReposDerivedState({
    repos,
    localRepos,
    activeRepo,
    recentRepos,
    searchTerm,
    filterType,
    loadWorkflowRuns,
  });

  return buildGitHubReposScreenReturnModel({
    localProject: { projectFiles },
    token: { token, tokenLoading, tokenError, userLogin, userLoading },
    repos: { loadingRepos, reposError, loadRepos, refreshing, handleRefresh, combinedRepos, filteredRepos },
    selection: { activeRepo, activeRepoObj, activeBranch, recentRepos, addRecentRepo, clearRecentRepos },
    uiStates: { showRepoList, setShowRepoList, showNewRepo, setShowNewRepo, showRenameRepo, setShowRenameRepo, showAdvanced, setShowAdvanced },
    filtersAndForms: { searchTerm, setSearchTerm, filterType, setFilterType, newRepoName, setNewRepoName, newRepoPrivate, setNewRepoPrivate, renameName, setRenameName },
    ops: { handleSelectRepo, handleSelectBranch, handleCreateRepo, isCreating, handleRenameRepo, isRenaming, handleDeleteRepo, isDeletingRepo, handlePull, isPulling, pullProgress, handlePush, isPushing, openPushModalForPaths, handleOpenRepoOnGitHub, handleSyncSecrets, isSyncingSecrets },
    pushUi: { pushModalVisible, setPushModalVisible, pushCommitMessage, setPushCommitMessage, pushSelectedPaths, togglePushPath, setAllPushPaths, closePushModal, confirmPushSelected },
    pullUi: { pullModalVisible, pullPreviewLoading, pullPreview, closePullModal, applyPulledFiles },
    sync: { syncStatus, refreshSyncStatus },
    eas: { easProjectId, setEasProjectId, isEasLinking, easLinkStatus, handleEasLinkStatusCheck, handleEasLink },
    githubApiHelpers: { loadBranches, loadDefaultBranch, loadWorkflowRuns: workflowRuns },
    branchOps: { handleCreateBranch, handleRenameBranch, handleDeleteBranch },
    manageModal: { manageModal, manageValue, manageBusy, setManageValue, closeManageModal, confirmManageModal },
  });
}
