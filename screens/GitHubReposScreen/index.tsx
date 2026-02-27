import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";

import { styles } from "./styles";
import { useGitHubReposScreen } from "./hooks/useGitHubReposScreen";

import { HeaderSection } from "./components/HeaderSection";
import { TokenStatusSection } from "./components/TokenStatusSection";
import { RepoListItem } from "../../components/RepoListItem";
import { NewRepoSection } from "./components/NewRepoSection";
import { RenameRepoSection } from "./components/RenameRepoSection";
import { BranchSelector } from "./components/BranchSelector";
import type { GitHubRepo } from "../../hooks/useGitHubRepos";

import { RepoMetaSection } from "./components/RepoMetaSection";
import { FilterSection } from "./components/FilterSection";
import { SecretsSection } from "./components/SecretsSection";
// DiffFilesSection removed from this screen (Local↔Online Diff is the single view now)
import { RepoSyncSection } from "./components/RepoSyncSection";
// Branch management is now integrated into the Branch dropdown actions
import { ManageTextModal } from "./components/ManageTextModal";
import { LocalRemoteDiffSection } from "./components/LocalRemoteDiffSection";
import { PushOptionsModal } from "./components/PushOptionsModal";
import { PullPreviewModal } from "./components/PullPreviewModal";

export default function GitHubReposScreen() {
  const s = styles;

  const vm = useGitHubReposScreen();

  const {
    token,
    tokenLoading,
    tokenError,

    userLogin,

    loadingRepos,
    refreshing,
    handleRefresh,

    activeRepo,
    activeBranch,

    projectFiles,

    // repo list is always visible now
    showNewRepo,
    setShowNewRepo,
    showRenameRepo,
    setShowRenameRepo,

    // filters
    searchTerm,
    setSearchTerm,
    filterType,
    setFilterType,
    recentRepos,
    clearRecentRepos,
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
    setManageValue,
    closeManageModal,

  } = vm;

  const onNewRepo = useCallback(() => setShowNewRepo(true), [setShowNewRepo]);

  const onRenameRepoItem = useCallback(
    (repo: GitHubRepo) => {
      handleSelectRepo(repo);
      setShowRenameRepo(true);
    },
    [handleSelectRepo, setShowRenameRepo],
  );

  
  const handleSelectRecentRepo = useCallback(
    (repoFullName: string) => {
      handleSelectRepo(repoFullName);
    },
    [handleSelectRepo],
  );

  const repoData: GitHubRepo[] = useMemo(() => filteredRepos, [filteredRepos]);

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


  const listHeader = (
    <>
      <HeaderSection
        userLogin={userLogin}
        activeRepo={activeRepo}
        activeBranch={activeBranch}
        onNewRepo={onNewRepo}
        onRefresh={handleRefresh}
        syncStatus={syncStatus}
        onCheckStatus={refreshSyncStatus}
      />

      <TokenStatusSection
        tokenLoading={tokenLoading}
        token={token}
        tokenError={tokenError}
      />

      <View style={s.section}>
        <FilterSection
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filterType={filterType}
          setFilterType={setFilterType}
          recentRepos={recentRepos}
          activeRepo={activeRepo}
          onSelectRecentRepo={handleSelectRecentRepo}
          clearRecentRepos={clearRecentRepos}
        />

        <View style={[s.rowBetween, { marginTop: 10 }]}>
          <Text style={[s.sectionTitle, { marginBottom: 0 }]}>Repos</Text>
          {loadingRepos ? <ActivityIndicator size="small" color={theme.palette.primary} /> : null}
        </View>
      </View>
    </>
  );

  const listEmpty = !loadingRepos ? (
    <View style={[s.section, { alignItems: "center", paddingVertical: 24, gap: 8 }]}>
      <Text style={{ fontSize: 32, marginBottom: 4 }}>📁</Text>
      <Text style={{ fontSize: 14, fontWeight: "700", color: theme.palette.text.primary }}>
        Keine Repositories
      </Text>
      <Text
        style={{
          fontSize: 12,
          color: theme.palette.text.secondary,
          textAlign: "center",
          lineHeight: 18,
        }}
      >
        Lade Repos mit dem Button oben oder erstelle ein neues Repo.
      </Text>
    </View>
  ) : null;

  const listFooter = (
    <>
      {showNewRepo && (
        <NewRepoSection
          newRepoName={newRepoName}
          setNewRepoName={setNewRepoName}
          newRepoPrivate={newRepoPrivate}
          setNewRepoPrivate={setNewRepoPrivate}
          isCreating={isCreating}
          onCreateRepo={handleCreateRepo}
        />
      )}

      {showRenameRepo && (
        <RenameRepoSection
          activeRepo={activeRepo}
          renameName={renameName}
          setRenameName={setRenameName}
          isRenaming={isRenaming}
          onRenameRepo={handleRenameRepo}
        />
      )}

      {activeRepo && (
        <BranchSelector
          activeRepo={activeRepo}
          activeBranch={activeBranch}
          onSelectBranch={handleSelectBranch}
          onCreateBranch={handleCreateBranch}
          onRenameBranch={handleRenameBranch}
          onDeleteBranch={handleDeleteBranch}
          loadBranches={loadBranches}
          loadDefaultBranch={loadDefaultBranch}
        />
      )}

      <RepoSyncSection
        activeRepo={activeRepo}
        activeBranch={activeBranch}
        hasLocalFiles={!!projectFiles?.length}
        isPulling={isPulling}
        isPushing={isPushing}
        pullProgress={pullProgress}
        onPull={handlePull}
        onPush={handlePush}
      />

      <PushOptionsModal
        visible={pushModalVisible}
        commitMessage={pushCommitMessage}
        setCommitMessage={setPushCommitMessage}
        selected={pushSelectedPaths}
        togglePath={togglePushPath}
        setAll={setAllPushPaths}
        onCancel={closePushModal}
        onConfirm={confirmPushSelected}
        busy={isPushing}
      />

      <PullPreviewModal
        visible={pullModalVisible}
        loading={pullPreviewLoading}
        preview={pullPreview}
        pullProgress={pullProgress}
        onCancel={closePullModal}
        onOverwrite={() => applyPulledFiles("overwrite")}
        onSkipConflicts={() => applyPulledFiles("skipConflicts")}
        busy={isPulling}
      />

      <RepoMetaSection
        userLogin={userLogin}
        activeRepo={activeRepo}
        onOpenRepoOnGitHub={handleOpenRepoOnGitHub}
      />

      <SecretsSection activeRepo={activeRepo} onSyncSecrets={vm.handleSyncSecrets} syncing={vm.isSyncingSecrets} />

      <LocalRemoteDiffSection
        activeRepo={activeRepo}
        activeBranch={activeBranch}
        projectFiles={projectFiles as any}
      />

      <ManageTextModal
        visible={!!manageModal}
        title={manageModal?.title || ""}
        placeholder={manageModal?.placeholder || ""}
        confirmText={manageModal?.confirmText}
        value={manageValue}
        setValue={setManageValue}
        onCancel={closeManageModal}
        onConfirm={async () => {
          if (!manageModal) return;
          try {
            await manageModal.action(manageValue);
          } catch (e: any) {
            Alert.alert("❌", e?.message ?? "Aktion fehlgeschlagen");
          }
        }}
      />
    </>
  );

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
