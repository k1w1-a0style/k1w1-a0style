/* eslint-disable react/no-unescaped-entities */
// screens/GitHubReposScreen/index.tsx - Vereinfachtes Layout

import React from "react";
import {
  ScrollView,
  Alert,
  RefreshControl,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../theme";
import { BranchSelector } from "./components/BranchSelector";
import { WorkflowRunsSection } from "./components/WorkflowRunsSection";
import { useGitHubReposScreen } from "./hooks/useGitHubReposScreen";

export default function GitHubReposScreen() {
  const {
    activeRepo,
    activeBranch,
    repos,
    token,
    tokenLoading,
    refreshing,
    showRepoList,
    showNewRepo,
    searchTerm,
    newRepoName,
    isCreating,
    isPulling,
    isPushing,
    pullProgress,
    isEasLinking,
    easLinkStatus,
    loadingRepos,
    filteredRepos,
    manageModal,
    manageValue,
    setManageValue,
    setSearchTerm,
    setNewRepoName,
    closeManageModal,
    openRepoList,
    closeRepoList,
    openNewRepoModal,
    closeNewRepoModal,
    handleRefresh,
    handleSelectRepo,
    handleSelectBranch,
    handleCreateRepo,
    handlePush,
    handlePull,
    handleSyncSecrets,
    handleEasLink,
    openManageMenu,
    openOnGitHub,
    loadBranches,
    loadDefaultBranch,
    loadWorkflowRuns,
  } = useGitHubReposScreen();

  const renderActiveRepo = () => {
    if (!activeRepo) {
      return (
        <TouchableOpacity
          style={s.selectRepoBtn}
          onPress={openRepoList}
        >
          <Ionicons
            name="git-branch-outline"
            size={20}
            color={theme.palette.primary}
          />
          <Text style={s.selectRepoBtnText}>Repository auswählen</Text>
          <Ionicons
            name="chevron-down"
            size={16}
            color={theme.palette.text.secondary}
          />
        </TouchableOpacity>
      );
    }

    return (
      <View style={s.activeRepoCard}>
        <TouchableOpacity
          style={s.repoHeader}
          onPress={openRepoList}
        >
          <View style={s.repoInfo}>
            <Ionicons
              name="git-branch"
              size={18}
              color={theme.palette.primary}
            />
            <Text style={s.repoName} numberOfLines={1}>
              {activeRepo}
            </Text>
          </View>
          <Ionicons
            name="swap-horizontal"
            size={18}
            color={theme.palette.text.secondary}
          />
        </TouchableOpacity>

        {/* Quick Actions */}
        <View style={s.quickActions}>
          <TouchableOpacity
            style={[s.actionBtn, isPushing && s.actionBtnDisabled]}
            onPress={handlePush}
            disabled={isPushing}
          >
            {isPushing ? (
              <ActivityIndicator size="small" color={theme.palette.primary} />
            ) : (
              <>
                <Ionicons
                  name="cloud-upload-outline"
                  size={16}
                  color={theme.palette.primary}
                />
                <Text style={s.actionBtnText}>Push</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.actionBtn, isPulling && s.actionBtnDisabled]}
            onPress={handlePull}
            disabled={isPulling}
          >
            {isPulling ? (
              <ActivityIndicator size="small" color={theme.palette.primary} />
            ) : (
              <>
                <Ionicons
                  name="cloud-download-outline"
                  size={16}
                  color={theme.palette.primary}
                />
                <Text style={s.actionBtnText}>Pull</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.actionBtn} onPress={openOnGitHub}>
            <Ionicons
              name="open-outline"
              size={16}
              color={theme.palette.primary}
            />
            <Text style={s.actionBtnText}>GitHub</Text>
          </TouchableOpacity>
        </View>

        {/* More Actions */}
        <View style={s.moreActions}>
          <TouchableOpacity style={s.actionBtn} onPress={handleSyncSecrets}>
            <Ionicons
              name="sync-outline"
              size={16}
              color={theme.palette.primary}
            />
            <Text style={s.actionBtnText}>Secrets</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.actionBtn, isEasLinking && s.actionBtnDisabled]}
            onPress={handleEasLink}
            disabled={isEasLinking}
          >
            {isEasLinking ? (
              <ActivityIndicator size="small" color={theme.palette.primary} />
            ) : (
              <>
                <Ionicons
                  name="rocket-outline"
                  size={16}
                  color={theme.palette.primary}
                />
                <Text style={s.actionBtnText}>EAS Link</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.actionBtn} onPress={openManageMenu}>
            <Ionicons
              name="settings-outline"
              size={16}
              color={theme.palette.primary}
            />
            <Text style={s.actionBtnText}>Manage</Text>
          </TouchableOpacity>
        </View>

        <View style={s.easStatusRow}>
          <View
            style={[
              s.statusDot,
              {
                backgroundColor:
                  easLinkStatus === "ok"
                    ? theme.palette.success
                    : easLinkStatus === "missing"
                      ? theme.palette.error
                      : theme.palette.text.muted,
              },
            ]}
          />
          <Text style={s.easStatusText}>
            {easLinkStatus === "ok"
              ? "Workflow eas-link.yml vorhanden"
              : easLinkStatus === "missing"
                ? "Workflow eas-link.yml fehlt (wird bei EAS Link auto-gefixt)"
                : "Workflow-Status: unbekannt"}
          </Text>
        </View>

        {pullProgress ? (
          <Text style={s.progressText}>{pullProgress}</Text>
        ) : null}
      </View>
    );
  };

  const renderRepoList = () => {
    if (!showRepoList) return null;

    return (
      <View style={s.repoListOverlay}>
        <View style={s.repoListHeader}>
          <Text style={s.repoListTitle}>Repository wählen</Text>
          <TouchableOpacity onPress={closeRepoList}>
            <Ionicons
              name="close"
              size={24}
              color={theme.palette.text.primary}
            />
          </TouchableOpacity>
        </View>

        <TextInput
          style={s.searchInput}
          placeholder="🔍 Suchen..."
          placeholderTextColor={theme.palette.text.secondary}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />

        <ScrollView
          style={s.repoListScroll}
          showsVerticalScrollIndicator={false}
        >
          {loadingRepos && (
            <View style={s.loadingRow}>
              <ActivityIndicator size="small" color={theme.palette.primary} />
              <Text style={s.loadingText}>Lade Repos...</Text>
            </View>
          )}

          {filteredRepos.map((repo) => (
            <TouchableOpacity
              key={repo.id}
              style={[
                s.repoItem,
                repo.full_name === activeRepo && s.repoItemActive,
              ]}
              onPress={() => handleSelectRepo(repo)}
            >
              <Ionicons
                name={repo.private ? "lock-closed" : "globe-outline"}
                size={14}
                color={theme.palette.text.secondary}
              />
              <Text style={s.repoItemText} numberOfLines={1}>
                {repo.full_name}
              </Text>
              {repo.full_name === activeRepo && (
                <Ionicons
                  name="checkmark"
                  size={16}
                  color={theme.palette.primary}
                />
              )}
            </TouchableOpacity>
          ))}

          {filteredRepos.length === 0 && !loadingRepos && (
            <Text style={s.emptyText}>Keine Repos gefunden</Text>
          )}
        </ScrollView>

        <TouchableOpacity
          style={s.newRepoBtn}
          onPress={openNewRepoModal}
        >
          <Ionicons
            name="add-circle-outline"
            size={18}
            color={theme.palette.primary}
          />
          <Text style={s.newRepoBtnText}>Neues Repo erstellen</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderNewRepoModal = () => {
    if (!showNewRepo) return null;

    return (
      <View style={s.newRepoOverlay}>
        <View style={s.newRepoCard}>
          <Text style={s.newRepoTitle}>Neues Repository</Text>
          <TextInput
            style={s.newRepoInput}
            placeholder="repo-name"
            placeholderTextColor={theme.palette.text.secondary}
            value={newRepoName}
            onChangeText={setNewRepoName}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={s.newRepoActions}>
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={closeNewRepoModal}
            >
              <Text style={s.cancelBtnText}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.createBtn, isCreating && s.actionBtnDisabled]}
              onPress={handleCreateRepo}
              disabled={isCreating}
            >
              {isCreating ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={s.createBtnText}>Erstellen</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (tokenLoading) {
    return (
      <SafeAreaView style={s.screen} edges={["top"]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.palette.primary} />
          <Text style={s.loadingText}>Lade Token...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={s.screen} edges={["top"]}>
        <View style={s.center}>
          <Ionicons
            name="key-outline"
            size={48}
            color={theme.palette.text.secondary}
          />
          <Text style={s.noTokenTitle}>Kein GitHub Token</Text>
          <Text style={s.noTokenText}>
            Bitte hinterlege dein GitHub Personal Access Token im
            Verbindungen-Screen.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.palette.primary]}
            tintColor={theme.palette.primary}
          />
        }
      >
        {/* Header */}
        <View style={s.header}>
          <Ionicons
            name="logo-github"
            size={28}
            color={theme.palette.primary}
          />
          <View style={s.headerText}>
            <Text style={s.headerTitle}>GitHub</Text>
            <Text style={s.headerSub}>{repos.length} Repos</Text>
          </View>
        </View>

        {/* Active Repo Card */}
        {renderActiveRepo()}

        {/* Branch Selector - nur wenn Repo ausgewählt */}
        {activeRepo && (
          <BranchSelector
            activeRepo={activeRepo}
            activeBranch={activeBranch}
            onSelectBranch={handleSelectBranch}
            loadBranches={loadBranches}
            loadDefaultBranch={loadDefaultBranch}
          />
        )}

        {/* Workflow Runs - nur wenn Repo ausgewählt */}
        {activeRepo && (
          <WorkflowRunsSection
            activeRepo={activeRepo}
            loadWorkflowRuns={loadWorkflowRuns}
          />
        )}
      </ScrollView>

      {/* Overlays */}
      {renderRepoList()}
      {renderNewRepoModal()}

      {/* Manage Modal */}
      {manageModal ? (
        <View style={s.newRepoOverlay}>
          <View style={s.newRepoCard}>
            <Text style={s.newRepoTitle}>{manageModal.title}</Text>
            <TextInput
              style={s.newRepoInput}
              placeholder={manageModal.placeholder}
              placeholderTextColor={theme.palette.text.secondary}
              value={manageValue}
              onChangeText={setManageValue}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={s.newRepoActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={closeManageModal}>
                <Text style={s.cancelBtnText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.createBtn}
                onPress={async () => {
                  try {
                    await manageModal.action(manageValue);
                  } catch (e: any) {
                    Alert.alert("❌ Fehler", e?.message ?? "");
                  }
                }}
              >
                <Text style={s.createBtnText}>
                  {manageModal.confirmText ?? "OK"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.palette.background },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  headerText: { flex: 1 },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: theme.palette.text.primary,
  },
  headerSub: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    marginTop: 2,
  },

  selectRepoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    backgroundColor: theme.palette.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderStyle: "dashed",
  },
  selectRepoBtnText: {
    flex: 1,
    fontSize: 15,
    color: theme.palette.text.secondary,
  },

  activeRepoCard: {
    backgroundColor: theme.palette.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.palette.primary,
    padding: 14,
    marginBottom: 12,
  },
  repoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  repoInfo: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  repoName: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.palette.text.primary,
    flex: 1,
  },

  quickActions: { flexDirection: "row", gap: 8, marginTop: 14 },
  moreActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    backgroundColor: theme.palette.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.palette.primary,
  },

  progressText: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    marginTop: 8,
    textAlign: "center",
  },

  repoListOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.palette.background,
    padding: 16,
    paddingTop: 8,
  },
  repoListHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  repoListTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.palette.text.primary,
  },
  searchInput: {
    backgroundColor: theme.palette.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.palette.text.primary,
    marginBottom: 12,
  },
  repoListScroll: { flex: 1 },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
  },
  loadingText: { fontSize: 13, color: theme.palette.text.secondary },
  repoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    backgroundColor: theme.palette.card,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  repoItemActive: {
    borderColor: theme.palette.primary,
    backgroundColor: theme.palette.secondary,
  },
  repoItemText: { flex: 1, fontSize: 14, color: theme.palette.text.primary },
  emptyText: {
    textAlign: "center",
    color: theme.palette.text.secondary,
    padding: 24,
  },
  newRepoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    marginTop: 12,
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.primary,
  },
  newRepoBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.palette.primary,
  },

  newRepoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  newRepoCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: theme.palette.card,
    borderRadius: 16,
    padding: 20,
  },
  newRepoTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.palette.text.primary,
    marginBottom: 16,
  },
  newRepoInput: {
    backgroundColor: theme.palette.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.palette.text.primary,
    marginBottom: 16,
  },
  newRepoActions: { flexDirection: "row", gap: 10 },
  cancelBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.palette.text.secondary,
  },
  createBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: theme.palette.primary,
  },
  createBtnText: { fontSize: 14, fontWeight: "800", color: "#000" },

  noTokenTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.palette.text.primary,
    marginTop: 12,
  },
  noTokenText: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    textAlign: "center",
    lineHeight: 20,
  },
  easStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingVertical: 6,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 99,
    backgroundColor: theme.palette.text.muted,
  },
  easStatusText: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "700",
  },
});
