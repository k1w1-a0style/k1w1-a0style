import React, { useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { BuildLogsModal } from "../../components/BuildLogsModal";
import { theme } from "../../theme";

import { ChecklistSection, type CheckActionChip } from "./components/ChecklistSection";
import { BuildProgressSection } from "./components/BuildProgressSection";
import { BuildStatusSection } from "./components/BuildStatusSection";
import { BuildHistorySection } from "./components/BuildHistorySection";
import { WorkflowRunDetailModal } from "./components/WorkflowRunDetailModal";
import { BuildModeDropdown, RepoInfoBadge } from "./components/RepoProfileSection";
import { OneClickDeployCard } from "./components/OneClickDeployCard";
import { LogsAnalysisSection } from "./components/LogsAnalysisSection";
import { useEnhancedBuildScreen, MAX_RUNS_DISPLAY } from "./hooks/useEnhancedBuildScreen";
import { useOneClickDeploy } from "./hooks/useOneClickDeploy";

import { st } from "./index.styles";
import { styles } from "../../styles/enhancedBuildScreenStyles";

export default function EnhancedBuildScreen(): React.ReactElement {
  const s = useEnhancedBuildScreen();
  const navigation = useNavigation<any>();

  const checklistChipsById = useMemo(() => {
    const byId: Record<string, CheckActionChip[]> = {};

    const statusOf = (id: string) => s.checklistItems.find((i) => i.id === id)?.status;

    const badgeFor = (id: string) => {
      const st = statusOf(id);
      if (st === "fail") return "FEHLT";
      if (st === "pending") return "EMPFOHLEN";
      if (st === "running") return "LÄUFT";
      return undefined;
    };

    // Repo fehlt -> direkt zum Repo Screen
    if (statusOf("repo") === "fail") {
      byId.repo = [
        {
          id: "go_repo",
          label: "Repo wählen",
          badge: badgeFor("repo"),
          icon: "logo-github" as any,
          onPress: () => navigation.navigate("GitHubRepos"),
        },
      ];
    }

    // Tokens fehlen -> Connections
    if (statusOf("tokens") === "fail") {
      byId.tokens = [
        {
          id: "go_tokens",
          label: "Tokens setzen",
          badge: badgeFor("tokens"),
          icon: "link-outline" as any,
          onPress: () => navigation.navigate("Connections"),
        },
      ];
    }

    // Signing key fehlt -> Wizard
    if (statusOf("signing_key") === "fail") {
      byId.signing_key = [
        {
          id: "go_wizard",
          label: "Wizard öffnen",
          badge: badgeFor("signing_key"),
          icon: "key-outline" as any,
          onPress: () => navigation.navigate("CredentialsWizard"),
        },
      ];
    }

    // Diagnostic nicht grün -> Diagnostic starten (autorun)
    const diagStatus = statusOf("diagnostic");
    if (diagStatus === "pending" || diagStatus === "fail") {
      byId.diagnostic = [
        {
          id: "go_diag",
          label: "Diagnostic starten",
          badge: badgeFor("diagnostic"),
          icon: "flask-outline" as any,
          onPress: () => navigation.navigate("Diagnostic", { autoRun: true }),
        },
      ];
    }

    return byId;
  }, [navigation, s.checklistItems]);

  const deploy = useOneClickDeploy(
    s.buildProfile,
    s.repoFullName,
    s.branchName,
    s.hasStartBuild ? s.startBuildFn : undefined,
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
          <RepoInfoBadge
            repoFullName={s.repoFullName}
            branchName={s.branchName}
            sourceCommitSha={s.currentBuild?.sourceCommitSha ?? null}
          />
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
          disabled={!s.canStartBuildUi}
          disabledReason={s.buildBlockedReason}
          autoSyncSecrets={deploy.autoSyncSecrets}
          onToggleAutoSyncSecrets={deploy.toggleAutoSyncSecrets}
          onDeploy={deploy.runDeploy}
          onReset={deploy.resetSteps}
          onAbort={deploy.abort}
        />

        {/* Pre-Build Checklist */}
        <ChecklistSection items={s.checklistItems} actionChipsById={checklistChipsById} />

        {/* Build Progress */}
        <BuildProgressSection
          status={s.status}
          statusLabel={s.statusLabel}
          message={s.message}
          jobId={s.jobId}
          etaMs={s.etaMs}
          formatDuration={s.formatDuration}
          progress={s.progress}
          isDeploying={deploy.isDeploying}
          deploySteps={deploy.steps}
          buildBlockedReason={s.buildBlockedReason}
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
          selectedRepo={s.repoFullName}
          selectedBranch={s.branchName}
          selectedBuildProfile={s.buildProfile}
          hasStartBuild={s.hasStartBuild}
          buildLoading={s.buildLoading}
          showStartBuildAction={false}
          onStartBuild={s.onStartBuild}
          openRun={s.openRun}
        />

        {/* GitHub Actions moved to Repo Screen (Diff/Repo management). */}
        {!!s.runsEmptyStateText && (
          <View style={styles.card}>
            <Text style={styles.emptyText}>ℹ️ {s.runsEmptyStateText}</Text>
          </View>
        )}

        {/* Build History */}
        <BuildHistorySection
          historyLoading={s.historyLoading}
          stats={s.stats}
          history={s.history}
          clearHistory={s.clearHistory}
          deleteEntry={s.deleteHistoryEntry}
          openRun={s.openRun}
          historyFilter={s.historyFilter}
          setHistoryFilter={s.setHistoryFilter}
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

      <WorkflowRunDetailModal
        visible={s.runDetailVisible}
        onClose={() => s.setRunDetailVisible(false)}
        run={s.selectedRun}
        details={s.runDetails}
        jobs={s.runJobs}
        loading={s.runDetailLoading}
        error={s.runDetailError}
        onRefresh={s.refreshRunDetails}
        onOpenUrl={s.openRun}
        match={s.runMatch}
      />
    </SafeAreaView>
  );
}
