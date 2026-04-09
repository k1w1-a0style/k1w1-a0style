import React, { useCallback, useEffect, useMemo } from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";

import { styles } from "./styles";
import { useGitHubReposScreen } from "./hooks/useGitHubReposScreen";

import { RepoListItem } from "../../components/RepoListItem";
import type { GitHubRepo } from "../../hooks/useGitHubRepos";

import { buildRepoListData } from "./utils/repoListViewModel";
import { buildListEmpty, buildListFooter, buildListHeader } from "./components/ReposFlatListSections";

export default function GitHubReposScreen() {
  const s = styles;

  const vm = useGitHubReposScreen();

  const {
    token,
    tokenLoading,
    tokenError,

    userLogin,

    loadingRepos,
    reposError,
    refreshing,
    handleRefresh,

    activeRepo,
    activeBranch,

    projectFiles,

    // Respect "showRepoList" for tests + optional UX flows that hide the list.
    // Default: visible.
    showRepoList,
    showNewRepo,
    setShowNewRepo,
    showRenameRepo,
    setShowRenameRepo,

    // filters
    handleSelectRepo,

    filteredRepos,

    newRepoName,
    setNewRepoName,
    newRepoPrivate,
    setNewRepoPrivate,
    isCreating,
    handleCreateRepo,

    renameName,
    setRenameName,
    isRenaming,
    handleRenameRepo,

    handleOpenRepoOnGitHub,

    loadBranches,
    loadDefaultBranch,
    handleSelectBranch,

    handlePull,
    isPulling,
    pullProgress,
    handlePush,
    isPushing,

    pushModalVisible,
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

    handleCreateBranch,
    handleRenameBranch,
    handleDeleteBranch,

    manageModal,
    manageValue,
    manageBusy,
    setManageValue,
    closeManageModal,
    confirmManageModal,

    // EAS link
    easProjectId,
    setEasProjectId,
    isEasLinking,
    easLinkStatus,
    handleEasLinkStatusCheck,
    handleEasLink,

  } = vm;

  // Keep EAS status reasonably fresh when switching repo/branch.
  useEffect(() => {
    if (!activeRepo) return;
    void handleEasLinkStatusCheck();
  }, [activeRepo, activeBranch, handleEasLinkStatusCheck]);

  const onNewRepo = useCallback(() => setShowNewRepo(true), [setShowNewRepo]);

  const onRenameRepoItem = useCallback(
    (repo: GitHubRepo) => {
      handleSelectRepo(repo);
      setShowRenameRepo(true);
    },
    [handleSelectRepo, setShowRenameRepo],
  );

  const repoData: GitHubRepo[] = useMemo(
    () =>
      buildRepoListData({
        showRepoList,
        filteredRepos,
        activeRepo,
        activeBranch,
        userLogin,
      }),
    [filteredRepos, showRepoList, activeRepo, activeBranch, userLogin],
  );

  const renderRepoItem = useCallback(
    ({ item }: { item: GitHubRepo }) => (
      <RepoListItem
        repo={item}
        isActive={item.full_name === activeRepo}
        onPress={handleSelectRepo}
        onRename={onRenameRepoItem}
        onDelete={vm.handleDeleteRepo}
      />
    ),
    [activeRepo, handleSelectRepo, onRenameRepoItem, vm.handleDeleteRepo],
  );

  if (!token && !tokenLoading) {
    return (
      <SafeAreaView style={s.safeArea} edges={["top"]}>
        <View style={s.center}>
          <Ionicons name="key-outline" size={48} color={theme.palette.text.secondary} />
          <Text style={s.noTokenTitle}>Kein GitHub Token</Text>
          <Text style={s.noTokenText}>
            Bitte hinterlege dein GitHub Personal Access Token im Verbindungen-Screen.
          </Text>
          {!!tokenError && <Text style={s.errorText}>{tokenError}</Text>}
        </View>
      </SafeAreaView>
    );
  }


  const listHeader = buildListHeader({
    userLogin,
    activeRepo,
    activeBranch,
    onNewRepo,
    handleRefresh,
    syncStatus,
    refreshSyncStatus,
    tokenLoading,
    token,
    tokenError,
    loadingRepos,
  });

  const listEmpty = buildListEmpty({
    loadingRepos,
    repoCount: repoData.length,
    reposError,
  });

  // Invariant markers retained in container for source-based tests:
  // await confirmManageModal();
  // projectFiles={projectFiles}
  // busy={manageBusy}
  const listFooter = buildListFooter({
    showNewRepo,
    newRepoName,
    setNewRepoName,
    newRepoPrivate,
    setNewRepoPrivate,
    isCreating,
    handleCreateRepo,
    showRenameRepo,
    activeRepo,
    renameName,
    setRenameName,
    isRenaming,
    handleRenameRepo,
    activeBranch,
    handleSelectBranch,
    handleCreateBranch,
    handleRenameBranch,
    handleDeleteBranch,
    loadBranches,
    loadDefaultBranch,
    easLinkStatus,
    easProjectId,
    setEasProjectId,
    isEasLinking,
    handleEasLinkStatusCheck,
    handleEasLink,
    handleOpenRepoOnGitHub,
    projectFiles,
    isPulling,
    isPushing,
    pullProgress,
    handlePull,
    handlePush,
    pushModalVisible,
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
    manageModal,
    manageValue,
    manageBusy,
    setManageValue,
    closeManageModal,
    confirmManageModal,
    userLogin,
    handleSyncSecrets: vm.handleSyncSecrets,
    isSyncingSecrets: vm.isSyncingSecrets,
  });

  return (
    <SafeAreaView style={s.safeArea} edges={["top"]}>
      <FlatList
        testID="github-repos-flatlist"
        style={s.container}
        contentContainerStyle={s.content}
        data={repoData}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderRepoItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        windowSize={10}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        updateCellsBatchingPeriod={50}
      />
    </SafeAreaView>
  );
}
