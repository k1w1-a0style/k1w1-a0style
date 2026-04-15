import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../../theme";
import {
  formatRelativeTime,
  getSeverityColor,
  getWorkflowStatusColor,
  getWorkflowStatusText,
} from "../../../utils/buildScreenUtils";
import { styles } from "../../../styles/enhancedBuildScreenStyles";
import type { BuildStatus } from "../../../shared/types/build";
import type { WorkflowRun } from "../../../shared/types/workflowRun";

export function LogsAnalysisSection({
  status,
  shouldLoadLogs,
  githubRepoForLogs,
  logsWaitingReason,
  logsLoading,
  logsError,
  logs,
  analyses,
  workflowRun,
  onOpenModal,
  openRun,
}: {
  status: BuildStatus;
  shouldLoadLogs: boolean;
  githubRepoForLogs: string | null;
  logsWaitingReason: string | null;
  logsLoading: boolean;
  logsError: string | null;
  logs: { timestamp?: string; level: string; message: string }[];
  analyses: { category: string; severity: string; description: string; suggestion: string }[];
  workflowRun: WorkflowRun | null;
  onOpenModal: () => void;
  openRun: (url: string) => void;
}): React.ReactElement {
  return (
    <View style={styles.card}>
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.cardTitle, { marginBottom: 0 }]}>
          Logs & Fehleranalyse
        </Text>

        <View style={styles.logActions}>
          <TouchableOpacity
            style={styles.inlineLink}
            onPress={onOpenModal}
            disabled={logsLoading && logs.length === 0}
          >
            <Ionicons
              name="terminal-outline"
              size={16}
              color={theme.palette.primary}
            />
            <Text style={styles.inlineLinkText}>Live in App</Text>
          </TouchableOpacity>

          {workflowRun?.html_url ? (
            <TouchableOpacity
              style={styles.inlineLink}
              onPress={() => openRun(workflowRun.html_url)}
            >
              <Ionicons
                name="open-outline"
                size={16}
                color={theme.palette.primary}
              />
              <Text style={styles.inlineLinkText}>Run</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {!shouldLoadLogs && status === "idle" && (
        <Text style={styles.emptyText}>
          ℹ️ Logs werden geladen sobald ein Build gestartet wird.
        </Text>
      )}
      {!shouldLoadLogs && status === "starting" && !logsWaitingReason && (
        <Text style={styles.emptyText}>
          ℹ️ Build-Start läuft. Logs folgen, sobald die Run-ID vorliegt.
        </Text>
      )}

      {!!logsWaitingReason && (
        <Text style={styles.emptyText}>
          ℹ️ {logsWaitingReason}
        </Text>
      )}

      {!githubRepoForLogs && shouldLoadLogs && (
        <Text style={styles.emptyText}>
          ⚠️ Kein Repo gesetzt – Logs können nicht geladen werden.
        </Text>
      )}

      {/* WorkflowRun-Status anzeigen wenn verfügbar */}
      {workflowRun && (
        <View style={styles.workflowStatusBox}>
          <View style={styles.runHeader}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: getWorkflowStatusColor(
                    workflowRun.status,
                    workflowRun.conclusion || null,
                  ),
                },
              ]}
            />
            <Text style={styles.runTitle}>Run #{workflowRun.run_number}</Text>
          </View>
          <View style={styles.runMeta}>
            <Text
              style={[
                styles.runStatus,
                {
                  color: getWorkflowStatusColor(
                    workflowRun.status,
                    workflowRun.conclusion || null,
                  ),
                },
              ]}
            >
              {getWorkflowStatusText(
                workflowRun.status,
                workflowRun.conclusion || null,
              )}
            </Text>
            <Text style={styles.runDivider}>•</Text>
            <Text style={styles.runTime}>
              {formatRelativeTime(workflowRun.created_at)}
            </Text>
          </View>
        </View>
      )}

      {!!logsError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {logsError}</Text>
        </View>
      )}

      {logsLoading && <ActivityIndicator color="#00FF00" />}

      {analyses.length > 0 && (
        <View style={styles.analysisContainer}>
          {analyses.slice(0, 3).map((a, idx) => (
            <View
              key={`${a.category}-${idx}`}
              style={[
                styles.runItem,
                { borderColor: getSeverityColor(a.severity) },
              ]}
            >
              <Text style={styles.runTitle}>
                {a.category} ({a.severity})
              </Text>
              <Text style={styles.runTime}>{a.description}</Text>
              <Text style={styles.runTime}>💡 {a.suggestion}</Text>
            </View>
          ))}
        </View>
      )}

      {logs.length > 0 && (
        <View style={styles.logsContainer}>
          <Text style={styles.inputLabel}>
            Letzte Logs ({Math.min(logs.length, 20)} / {logs.length})
          </Text>
          <View style={styles.runList}>
            {logs.slice(-20).map((l, idx) => (
              <View key={`${l.timestamp}-${idx}`} style={styles.runItem}>
                <Text style={styles.runTime}>
                  {l.timestamp} • {l.level}
                </Text>
                <Text style={styles.runTitle}>{l.message}</Text>
              </View>
            ))}
          </View>
          {!!workflowRun?.html_url && (
            <TouchableOpacity
              style={[styles.primaryBtn, styles.logsBtnSpacing]}
              onPress={() => openRun(workflowRun.html_url)}
            >
              <Text style={styles.primaryBtnText}>↗️ Run öffnen</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}
