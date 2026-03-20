import React, { useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Pressable,
  TextInput,
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

  const repoData: GitHubRepo[] = useMemo(() => {
    if (!(showRepoList ?? true)) return [];
    if (filteredRepos.length > 0) return filteredRepos;

    if (activeRepo) {
      return [
        {
          id: `linked:${activeRepo}`,
          name: activeRepo.split("/").pop() || activeRepo,
          full_name: activeRepo,
          private: true,
          default_branch: activeBranch || undefined,
          owner: { login: activeRepo.split("/")[0] || userLogin || "unknown" },
          html_url: `https://github.com/${activeRepo}`,
        } as unknown as GitHubRepo,
      ];
    }

    return [];
  }, [filteredRepos, showRepoList, activeRepo, activeBranch, userLogin]);

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
        <View style={[s.rowBetween, { marginTop: 0 }]}>
          <Text style={[s.sectionTitle, { marginBottom: 0 }]}>Repos</Text>
          {loadingRepos ? <ActivityIndicator size="small" color={theme.palette.primary} /> : null}
        </View>
      </View>
    </>
  );

  const listEmpty = !loadingRepos && repoData.length === 0 ? (
    <View style={[s.section, { alignItems: "center", paddingVertical: 24, gap: 8 }]}>
      <Text style={{ fontSize: 32, marginBottom: 4 }}>{reposError ? "⚠️" : "📁"}</Text>
      <Text style={{ fontSize: 14, fontWeight: "700", color: theme.palette.text.primary }}>
        {reposError ? "Repos konnten nicht geladen werden" : "Keine Repositories"}
      </Text>
      <Text
        style={{
          fontSize: 12,
          color: theme.palette.text.secondary,
          textAlign: "center",
          lineHeight: 18,
        }}
      >
        {reposError ? reposError : "Lade Repos mit dem Button oben oder erstelle ein neues Repo."}
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

      {activeRepo && (
        <View style={[s.section, s.sectionNeon]} testID="eas-link-section">
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={s.sectionTitle}>EAS Link</Text>
            <View style={s.chipRow}>
              <View
                style={[
                  s.chip,
                  easLinkStatus.state === "verified" ? s.chipActive : null,
                  easLinkStatus.tone === "error" ? { borderColor: theme.palette.error } : null,
                  easLinkStatus.tone === "warn" ? { borderColor: theme.palette.warning ?? theme.palette.primary } : null,
                ]}
              >
                <Text
                  style={[
                    s.chipText,
                    easLinkStatus.state === "verified" ? s.chipTextActive : null,
                    easLinkStatus.tone === "error" ? { color: theme.palette.error } : null,
                    easLinkStatus.tone === "warn" ? { color: theme.palette.warning ?? theme.palette.primary } : null,
                  ]}
                >
                  {easLinkStatus.label}
                </Text>
              </View>

              <Pressable
                testID="eas-link-refresh"
                onPress={() => void handleEasLinkStatusCheck()}
                style={({ pressed }: { pressed: boolean }) => [s.iconBtn, pressed && { opacity: 0.7 }]}
                accessibilityLabel="EAS Status prüfen"
              >
                <Ionicons name="refresh" size={18} color={theme.palette.primary} />
              </Pressable>
            </View>
          </View>

          <Text style={{ fontSize: 12, color: theme.palette.text.secondary, lineHeight: 18, marginTop: -2, marginBottom: 8 }}>
            Dieser Repo-Schritt prueft Workflow und Projektdatei getrennt. Nur ein voll passender Workflow plus passende
            <Text style={{ fontFamily: "monospace", color: theme.palette.text.primary }}> eas-project.json</Text> gilt hier als verifiziert.
            Tokens/Grundverbindungen pflegst du weiterhin im Verbindungen-Screen.
          </Text>

          <Text
            testID="eas-link-detail"
            style={{ fontSize: 12, color: theme.palette.text.secondary, lineHeight: 18, marginBottom: 10 }}
          >
            {easLinkStatus.detail}
          </Text>

          <TextInput
            testID="eas-project-id"
            value={easProjectId}
            onChangeText={setEasProjectId}
            placeholder="EAS Project ID (optional)"
            placeholderTextColor={theme.palette.text.secondary}
            autoCapitalize="none"
            autoCorrect={false}
            style={s.searchInput}
          />

          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <Pressable
              testID="eas-link-run"
              onPress={() => void handleEasLink()}
              disabled={isEasLinking}
              style={({ pressed }: { pressed: boolean }) => [s.button, pressed && { opacity: 0.85 }, isEasLinking && s.buttonDisabled]}
            >
              <Text style={s.buttonText}>{isEasLinking ? "EAS Link läuft…" : "EAS Projekt erstellen/verbinden"}</Text>
            </Pressable>

            <Pressable
              testID="eas-link-open"
              onPress={() => activeRepo && handleOpenRepoOnGitHub()}
              style={({ pressed }: { pressed: boolean }) => [s.button, s.buttonSecondary, pressed && { opacity: 0.85 }]}
            >
              <Text style={s.buttonTextSecondary}>Repo öffnen</Text>
            </Pressable>
          </View>
        </View>
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
        projectFiles={projectFiles}
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
          try {
            await confirmManageModal();
          } catch (e: any) {
            Alert.alert("❌", e?.message ?? "Aktion fehlgeschlagen");
          }
        }}
        busy={manageBusy}
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
