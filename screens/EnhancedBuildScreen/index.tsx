import React from "react";
import { RefreshControl, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BuildLogsModal } from "../../components/BuildLogsModal";
import { styles } from "../../styles/enhancedBuildScreenStyles";

import { HeaderSection } from "./components/HeaderSection";
import { BuildStatusSection } from "./components/BuildStatusSection";
import { RepoProfileSection } from "./components/RepoProfileSection";
import { GitHubActionsSection } from "./components/GitHubActionsSection";
import { LogsAnalysisSection } from "./components/LogsAnalysisSection";
import { BuildHistorySection } from "./components/BuildHistorySection";
import { useEnhancedBuildScreen, MAX_RUNS_DISPLAY } from "./hooks/useEnhancedBuildScreen";

export default function EnhancedBuildScreen(): React.ReactElement {
  const s = useEnhancedBuildScreen();

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={s.refreshing}
            onRefresh={s.onRefresh}
            tintColor="#00FF00"
            colors={["#00FF00"]}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <HeaderSection projectName={s.projectData?.name} />

        <BuildStatusSection
          status={s.status}
          statusEmoji={s.statusEmoji}
          statusLabel={s.statusLabel}
          message={s.message}
          jobId={s.jobId}
          etaMs={s.etaMs}
          formatDuration={s.formatDuration}
          currentBuild={s.currentBuild}
          hasStartBuild={s.hasStartBuild}
          buildLoading={s.buildLoading}
          onStartBuild={s.onStartBuild}
          openRun={s.openRun}
        />

        <RepoProfileSection
          repoFullName={s.repoFullName}
          onChangeRepoFullName={s.setRepoFullName}
          branchName={s.branchName}
          onChangeBranchName={s.setBranchName}
          onSaveRepoBranch={s.onSaveRepoBranch}
          buildProfile={s.buildProfile}
          onSelectBuildProfile={s.onSelectBuildProfile}
          hasSetLinkedRepo={s.hasSetLinkedRepo}
          savingRepo={s.savingRepo}
          onSaveLinkedRepo={s.onSaveLinkedRepo}
        />

        <GitHubActionsSection
          hasGetWorkflowRuns={s.hasGetWorkflowRuns}
          canFetch={s.canFetch}
          loadingRuns={s.loadingRuns}
          error={s.error}
          runs={s.runs}
          moreCount={s.moreCount}
          maxRunsDisplay={MAX_RUNS_DISPLAY}
          fetchRuns={s.fetchRuns}
          openRun={s.openRun}
        />

        <LogsAnalysisSection
          status={s.status}
          shouldLoadLogs={s.shouldLoadLogs}
          githubRepoForLogs={s.githubRepoForLogs}
          logsLoading={s.logsLoading}
          logsError={s.logsError}
          logs={s.logs}
          analyses={s.analyses}
          workflowRun={s.workflowRun}
          onOpenModal={() => s.setLogModalVisible(true)}
          openRun={s.openRun}
        />

        <BuildHistorySection
          historyLoading={s.historyLoading}
          stats={s.stats}
          history={s.history}
          clearHistory={s.clearHistory}
          openRun={s.openRun}
        />
      </ScrollView>

      <BuildLogsModal
        visible={s.logModalVisible}
        onClose={() => s.setLogModalVisible(false)}
        logs={s.logLines}
        isLoading={s.logsLoading}
        error={s.logsError}
        onManualRefresh={s.refreshLogs}
        autoRefreshEnabled={s.shouldLoadLogs && s.autoRefreshEnabled}
        onToggleAutoRefresh={s.setAutoRefreshEnabled}
        defaultOnlyErrors={s.status === "failed" || s.status === "error"}
      />
    </SafeAreaView>
  );
}
