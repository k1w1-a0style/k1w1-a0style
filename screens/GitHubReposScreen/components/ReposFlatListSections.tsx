import React from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";

import { theme } from "../../../theme";
import { styles } from "../styles";
import { HeaderSection } from "./HeaderSection";
import { TokenStatusSection } from "./TokenStatusSection";
import { NewRepoSection } from "./NewRepoSection";
import { RenameRepoSection } from "./RenameRepoSection";
import { BranchSelector } from "./BranchSelector";
import { EasLinkSection } from "./EasLinkSection";
import { RepoSyncSection } from "./RepoSyncSection";
import { PushOptionsModal } from "./PushOptionsModal";
import { PullPreviewModal } from "./PullPreviewModal";
import { RepoMetaSection } from "./RepoMetaSection";
import { SecretsSection } from "./SecretsSection";
import { LocalRemoteDiffSection } from "./LocalRemoteDiffSection";
import { ManageTextModal } from "./ManageTextModal";
import { getErrorMessage } from "../hooks/githubReposScreenErrorHelpers";
import type { UseGitHubReposScreenModel } from "../hooks/useGitHubReposScreen.model";

type HeaderParams = Pick<UseGitHubReposScreenModel,
  "userLogin" | "activeRepo" | "activeBranch" | "handleRefresh" | "syncStatus" | "refreshSyncStatus" | "tokenLoading" | "token" | "tokenError" | "loadingRepos"
> & {
  onNewRepo: () => void;
};

export function buildListHeader(params: HeaderParams) {
  const s = styles;
  return (
    <>
      <HeaderSection
        userLogin={params.userLogin}
        activeRepo={params.activeRepo}
        activeBranch={params.activeBranch}
        onNewRepo={params.onNewRepo}
        onRefresh={params.handleRefresh}
        syncStatus={params.syncStatus}
        onCheckStatus={params.refreshSyncStatus}
      />

      <TokenStatusSection
        tokenLoading={params.tokenLoading}
        token={params.token}
        tokenError={params.tokenError}
      />

      <View style={s.section}>
        <View style={[s.rowBetween, { marginTop: 0 }]}> 
          <Text style={[s.sectionTitle, { marginBottom: 0 }]}>Repos</Text>
          {params.loadingRepos ? <ActivityIndicator size="small" color={theme.palette.primary} /> : null}
        </View>
      </View>
    </>
  );
}

type EmptyParams = Pick<UseGitHubReposScreenModel, "loadingRepos" | "reposError"> & {
  repoCount: number;
};

export function buildListEmpty(params: EmptyParams) {
  if (params.loadingRepos || params.repoCount > 0) return null;
  const s = styles;
  return (
    <View style={[s.section, { alignItems: "center", paddingVertical: 24, gap: 8 }]}> 
      <Text style={{ fontSize: 32, marginBottom: 4 }}>{params.reposError ? "⚠️" : "📁"}</Text>
      <Text style={{ fontSize: 14, fontWeight: "700", color: theme.palette.text.primary }}>
        {params.reposError ? "Repos konnten nicht geladen werden" : "Keine Repositories"}
      </Text>
      <Text
        style={{
          fontSize: 12,
          color: theme.palette.text.secondary,
          textAlign: "center",
          lineHeight: 18,
        }}
      >
        {params.reposError ? params.reposError : "Lade Repos mit dem Button oben oder erstelle ein neues Repo."}
      </Text>
    </View>
  );
}

type FooterParams = Pick<UseGitHubReposScreenModel,
  | "showNewRepo"
  | "newRepoName"
  | "setNewRepoName"
  | "newRepoPrivate"
  | "setNewRepoPrivate"
  | "isCreating"
  | "handleCreateRepo"
  | "showRenameRepo"
  | "activeRepo"
  | "renameName"
  | "setRenameName"
  | "isRenaming"
  | "handleRenameRepo"
  | "activeBranch"
  | "handleSelectBranch"
  | "handleCreateBranch"
  | "handleRenameBranch"
  | "handleDeleteBranch"
  | "loadBranches"
  | "loadDefaultBranch"
  | "easLinkStatus"
  | "easProjectId"
  | "setEasProjectId"
  | "isEasLinking"
  | "handleEasLinkStatusCheck"
  | "handleEasLink"
  | "handleOpenRepoOnGitHub"
  | "projectFiles"
  | "isPulling"
  | "isPushing"
  | "pullProgress"
  | "handlePull"
  | "handlePush"
  | "pushModalVisible"
  | "pushCommitMessage"
  | "setPushCommitMessage"
  | "pushSelectedPaths"
  | "togglePushPath"
  | "setAllPushPaths"
  | "closePushModal"
  | "confirmPushSelected"
  | "pullModalVisible"
  | "pullPreviewLoading"
  | "pullPreview"
  | "closePullModal"
  | "applyPulledFiles"
  | "manageModal"
  | "manageValue"
  | "manageBusy"
  | "setManageValue"
  | "closeManageModal"
  | "confirmManageModal"
  | "userLogin"
  | "handleSyncSecrets"
  | "isSyncingSecrets"
>;

export function buildListFooter(params: FooterParams) {
  return (
    <>
      {params.showNewRepo && (
        <NewRepoSection
          newRepoName={params.newRepoName}
          setNewRepoName={params.setNewRepoName}
          newRepoPrivate={params.newRepoPrivate}
          setNewRepoPrivate={params.setNewRepoPrivate}
          isCreating={params.isCreating}
          onCreateRepo={params.handleCreateRepo}
        />
      )}

      {params.showRenameRepo && (
        <RenameRepoSection
          activeRepo={params.activeRepo}
          renameName={params.renameName}
          setRenameName={params.setRenameName}
          isRenaming={params.isRenaming}
          onRenameRepo={params.handleRenameRepo}
        />
      )}

      {params.activeRepo && (
        <BranchSelector
          activeRepo={params.activeRepo}
          activeBranch={params.activeBranch}
          onSelectBranch={params.handleSelectBranch}
          onCreateBranch={params.handleCreateBranch}
          onRenameBranch={params.handleRenameBranch}
          onDeleteBranch={params.handleDeleteBranch}
          loadBranches={params.loadBranches}
          loadDefaultBranch={params.loadDefaultBranch}
        />
      )}

      {params.activeRepo && (
        <EasLinkSection
          easLinkStatus={params.easLinkStatus}
          easProjectId={params.easProjectId}
          setEasProjectId={params.setEasProjectId}
          isEasLinking={params.isEasLinking}
          handleEasLinkStatusCheck={params.handleEasLinkStatusCheck}
          handleEasLink={params.handleEasLink}
          handleOpenRepoOnGitHub={params.handleOpenRepoOnGitHub}
          activeRepo={params.activeRepo}
        />
      )}

      <RepoSyncSection
        activeRepo={params.activeRepo}
        activeBranch={params.activeBranch}
        hasLocalFiles={!!params.projectFiles?.length}
        isPulling={params.isPulling}
        isPushing={params.isPushing}
        pullProgress={params.pullProgress}
        onPull={params.handlePull}
        onPush={params.handlePush}
      />

      <PushOptionsModal
        visible={params.pushModalVisible}
        commitMessage={params.pushCommitMessage}
        setCommitMessage={params.setPushCommitMessage}
        selected={params.pushSelectedPaths}
        togglePath={params.togglePushPath}
        setAll={params.setAllPushPaths}
        onCancel={params.closePushModal}
        onConfirm={params.confirmPushSelected}
        busy={params.isPushing}
      />

      <PullPreviewModal
        visible={params.pullModalVisible}
        loading={params.pullPreviewLoading}
        preview={params.pullPreview}
        pullProgress={params.pullProgress}
        onCancel={params.closePullModal}
        onOverwrite={() => params.applyPulledFiles("overwrite")}
        onSkipConflicts={() => params.applyPulledFiles("skipConflicts")}
        busy={params.isPulling}
      />

      <RepoMetaSection
        userLogin={params.userLogin}
        activeRepo={params.activeRepo}
        onOpenRepoOnGitHub={params.handleOpenRepoOnGitHub}
      />

      <SecretsSection activeRepo={params.activeRepo} onSyncSecrets={params.handleSyncSecrets} syncing={params.isSyncingSecrets} />

      <LocalRemoteDiffSection
        activeRepo={params.activeRepo}
        activeBranch={params.activeBranch}
        projectFiles={params.projectFiles}
      />

      <ManageTextModal
        visible={!!params.manageModal}
        title={params.manageModal?.title || ""}
        placeholder={params.manageModal?.placeholder || ""}
        confirmText={params.manageModal?.confirmText}
        value={params.manageValue}
        setValue={params.setManageValue}
        onCancel={params.closeManageModal}
        onConfirm={async () => {
          try {
            await params.confirmManageModal();
          } catch (e: unknown) {
            Alert.alert("❌", getErrorMessage(e, "Aktion fehlgeschlagen"));
          }
        }}
        busy={params.manageBusy}
      />
    </>
  );
}
