import React from "react";
import { RefreshControl, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BuildLogsModal } from "../../components/BuildLogsModal";
import { styles } from "../../styles/enhancedBuildScreenStyles";

import { HeaderSection } from "./components/HeaderSection";
import { BuildStatusSection } from "./components/BuildStatusSection";
import { RepoProfileSection } from "./components/RepoProfileSection";
import { LogsAnalysisSection } from "./components/LogsAnalysisSection";
import { ChecklistSection } from "./components/ChecklistSection";
import { BuildProgressSection } from "./components/BuildProgressSection";
import { DiffSection } from "./components/DiffSection";
import { useEnhancedBuildScreen } from "./hooks/useEnhancedBuildScreen";

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

        {/* Pre-Build Checklist */}
        <ChecklistSection items={s.checklistItems} />

        {/* Build Progress Bar */}
        <BuildProgressSection
          status={s.status}
          statusLabel={s.statusLabel}
          message={s.message}
          jobId={s.jobId}
          etaMs={s.etaMs}
          formatDuration={s.formatDuration}
          progress={s.progress}
        />

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

        {/* Diff-Anzeige statt GitHub Actions */}
        <DiffSection
          oldText={s.diffOldText}
          newText={s.diffNewText}
          title="Letzte Aenderungen"
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
