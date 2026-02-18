import React from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { BuildLogsModal } from "../../components/BuildLogsModal";
import { theme } from "../../theme";

import { ChecklistSection } from "./components/ChecklistSection";
import { BuildProgressSection } from "./components/BuildProgressSection";
import { BuildStatusSection } from "./components/BuildStatusSection";
import { BuildModeDropdown, RepoInfoBadge } from "./components/RepoProfileSection";
import { OneClickDeployCard } from "./components/OneClickDeployCard";
import { DiffSection } from "./components/DiffSection";
import { LogsAnalysisSection } from "./components/LogsAnalysisSection";
import { useEnhancedBuildScreen } from "./hooks/useEnhancedBuildScreen";
import { useOneClickDeploy } from "./hooks/useOneClickDeploy";

export default function EnhancedBuildScreen(): React.ReactElement {
  const s = useEnhancedBuildScreen();

  const deploy = useOneClickDeploy(
    s.buildProfile,
    s.repoFullName,
    s.branchName,
    s.hasStartBuild ? (s as any).startBuildFn : undefined,
  );

  return (
    <SafeAreaView style={st.root} edges={["top"]}>
      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.content}
        refreshControl={
          <RefreshControl
            refreshing={s.refreshing}
            onRefresh={s.onRefresh}
            tintColor={theme.palette.primary}
            colors={[theme.palette.primary]}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={st.header}>
          <Ionicons name="construct-outline" size={20} color={theme.palette.primary} />
          <View style={st.headerText}>
            <Text style={st.title}>Build</Text>
            <Text style={st.subtitle}>
              {s.projectData?.name || "APK Builder"}
            </Text>
          </View>
        </View>

        {/* Repo Info (read-only) */}
        <View style={st.section}>
          <RepoInfoBadge repoFullName={s.repoFullName} branchName={s.branchName} />
        </View>

        {/* Build Mode Dropdown */}
        <View style={st.section}>
          <BuildModeDropdown value={s.buildProfile} onChange={s.onSelectBuildProfile} />
        </View>

        {/* One-Click Deploy */}
        <OneClickDeployCard
          steps={deploy.steps}
          isDeploying={deploy.isDeploying}
          deployDone={deploy.deployDone}
          onDeploy={deploy.runDeploy}
          onReset={deploy.resetSteps}
          onAbort={deploy.abort}
        />

        {/* Pre-Build Checklist */}
        <ChecklistSection items={s.checklistItems} />

        {/* Build Progress */}
        <BuildProgressSection
          status={s.status}
          statusLabel={s.statusLabel}
          message={s.message}
          jobId={s.jobId}
          etaMs={s.etaMs}
          formatDuration={s.formatDuration}
          progress={s.progress}
        />

        {/* Build Status + Actions */}
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

        {/* Diff */}
        <DiffSection
          oldText={s.diffOldText}
          newText={s.diffNewText}
          title="Letzte Aenderungen"
        />

        {/* Logs */}
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

        <View style={{ height: 40 }} />
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

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.palette.background },
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  headerText: { flex: 1 },
  title: {
    color: theme.palette.text.primary,
    fontSize: 20,
    fontWeight: "900",
  },
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: 13,
  },
  section: {
    marginTop: 14,
    marginHorizontal: 16,
  },
});
