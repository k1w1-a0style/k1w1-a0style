import React, { useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TextInput,
  TouchableOpacity,
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
import { FilterSection } from "./components/FilterSection";
import { RepoListSection } from "./components/RepoListSection";
import { ActionsSection } from "./components/ActionsSection";
import { NewRepoSection } from "./components/NewRepoSection";
import { RenameRepoSection } from "./components/RenameRepoSection";
import { BranchSelector } from "./components/BranchSelector";
import { WorkflowRunsSection } from "./components/WorkflowRunsSection";
import { splitFullName } from "./utils/repos";

export default function GitHubReposScreen() {
  const s = styles;

  const vm = useGitHubReposScreen();

  const {
    token,
    tokenLoading,
    tokenError,

    loadingRepos,
    loadRepos,
    refreshing,
    handleRefresh,

    activeRepo,
    activeBranch,

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

    recentRepos,
    clearRecentRepos,

    filteredRepos,
    handleSelectRepo,

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

    isPushing,
    handlePush,
    isPulling,
    handlePull,
    pullProgress,

    isSyncingSecrets,
    handleSyncSecrets,

    handleOpenRepoOnGitHub,

    loadBranches,
    loadDefaultBranch,
    handleSelectBranch,

    manageModal,
    manageValue,
    setManageValue,
    closeManageModal,

    handleCreateBranch,
    handleRenameBranch,
    handleDeleteBranch,

    loadWorkflowRuns,
  } = vm;

  const onToggleRepoList = useCallback(() => setShowRepoList((v) => !v), [setShowRepoList]);
  const onToggleNewRepo = useCallback(() => setShowNewRepo((v) => !v), [setShowNewRepo]);
  const onToggleAdvanced = useCallback(() => setShowAdvanced((v) => !v), [setShowAdvanced]);

  const handleOpenManage = useCallback(() => {
    if (!activeRepo) {
      Alert.alert("⚠️", "Kein Repo ausgewählt.");
      return;
    }
    Alert.alert(
      "Manage",
      activeRepo,
      [
        { text: "Repo umbenennen", onPress: () => setShowRenameRepo(true) },
        { text: "Branch erstellen", onPress: handleCreateBranch },
        { text: "Branch umbenennen", onPress: handleRenameBranch },
        { text: "Branch löschen", style: "destructive", onPress: handleDeleteBranch },
        { text: "Abbrechen", style: "cancel" },
      ],
    );
  }, [activeRepo, setShowRenameRepo, handleCreateBranch, handleRenameBranch, handleDeleteBranch]);

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

  const parsed = activeRepo ? splitFullName(activeRepo) : null;

  return (
    <SafeAreaView style={s.safeArea} edges={["top"]}>
      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <HeaderSection
          showRepoList={showRepoList}
          onToggleRepoList={onToggleRepoList}
          showNewRepo={showNewRepo}
          onToggleNewRepo={onToggleNewRepo}
          showAdvanced={showAdvanced}
          onToggleAdvanced={onToggleAdvanced}
          onRefresh={handleRefresh}
        />

        <TokenStatusSection
          tokenLoading={tokenLoading}
          token={token}
          tokenError={tokenError}
          loadingRepos={loadingRepos}
          loadRepos={loadRepos}
        />

        <FilterSection
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filterType={filterType}
          setFilterType={setFilterType}
          recentRepos={recentRepos}
          activeRepo={activeRepo}
          setActiveRepo={vm.setActiveRepo}
          clearRecentRepos={clearRecentRepos}
        />

        {showRepoList && (
          <RepoListSection
            loadingRepos={loadingRepos}
            filteredRepos={filteredRepos}
            activeRepo={activeRepo}
            onSelectRepo={handleSelectRepo}
            onDeleteRepo={vm.handleDeleteRepo}
          />
        )}

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

        <ActionsSection
          activeRepo={activeRepo}
          isPushing={isPushing}
          onPush={handlePush}
          isPulling={isPulling}
          onPull={handlePull}
          isSyncingSecrets={isSyncingSecrets}
          onSyncSecrets={handleSyncSecrets}
          onOpenRepoOnGitHub={handleOpenRepoOnGitHub}
          onOpenManage={handleOpenManage}
          pullProgress={pullProgress}
        />

        {activeRepo && (
          <BranchSelector
            activeRepo={activeRepo}
            activeBranch={activeBranch}
            onSelectBranch={handleSelectBranch}
            loadBranches={loadBranches}
            loadDefaultBranch={loadDefaultBranch}
          />
        )}

        {activeRepo && showAdvanced && (
          <WorkflowRunsSection
            activeRepo={activeRepo}
            loadWorkflowRuns={loadWorkflowRuns}
          />
        )}

        {manageModal && (
          <View style={s.manageCard}>
            <Text style={s.manageTitle}>{manageModal.title}</Text>
            <TextInput
              style={s.manageInput}
              placeholder={manageModal.placeholder}
              placeholderTextColor={theme.palette.text.secondary}
              value={manageValue}
              onChangeText={setManageValue}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={s.manageRow}>
              <TouchableOpacity style={[s.button, s.buttonSecondary]} onPress={closeManageModal}>
                <Text style={s.buttonTextSecondary}>Abbrechen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.button}
                onPress={async () => {
                  try {
                    await manageModal.action(manageValue);
                  } catch (e: any) {
                    Alert.alert("❌ Fehler", e?.message ?? "");
                  }
                }}
              >
                <Text style={s.buttonText}>{manageModal.confirmText ?? "OK"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
