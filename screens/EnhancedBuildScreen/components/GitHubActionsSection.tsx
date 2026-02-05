import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import {
  formatRelativeTime,
  getWorkflowStatusColor,
  getWorkflowStatusText,
} from "../../../utils/buildScreenUtils";
import { styles } from "../../../styles/enhancedBuildScreenStyles";
import type { WorkflowRun } from "../types";

export function GitHubActionsSection({
  hasGetWorkflowRuns,
  canFetch,
  loadingRuns,
  error,
  runs,
  moreCount,
  maxRunsDisplay,
  fetchRuns,
  openRun,
}: {
  hasGetWorkflowRuns: boolean;
  canFetch: boolean;
  loadingRuns: boolean;
  error: string | null;
  runs: WorkflowRun[];
  moreCount: number;
  maxRunsDisplay: number;
  fetchRuns: () => void;
  openRun: (url: string) => void;
}): React.ReactElement {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>GitHub Actions</Text>

      {!hasGetWorkflowRuns && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            ⚠️ getWorkflowRuns() ist nicht im ProjectContext definiert.
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.primaryBtn,
          (!canFetch || !hasGetWorkflowRuns || loadingRuns) && styles.btnDisabled,
        ]}
        onPress={fetchRuns}
        disabled={!canFetch || !hasGetWorkflowRuns || loadingRuns}
      >
        {loadingRuns ? (
          <ActivityIndicator color="#1a1a1a" />
        ) : (
          <Text style={styles.primaryBtnText}>📥 Workflow Runs laden</Text>
        )}
      </TouchableOpacity>

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {runs.length > 0 && (
        <View style={styles.runList}>
          {runs.slice(0, maxRunsDisplay).map((run) => {
            const c = getWorkflowStatusColor(run.status, run.conclusion);
            const t = getWorkflowStatusText(run.status, run.conclusion);
            const timeAgo = formatRelativeTime(run.created_at);

            return (
              <TouchableOpacity
                key={run.id}
                style={styles.runItem}
                onPress={() => openRun(run.html_url)}
                activeOpacity={0.7}
              >
                <View style={styles.runHeader}>
                  <View style={[styles.statusDot, { backgroundColor: c }]} />
                  <Text style={styles.runTitle} numberOfLines={1}>
                    {run.name || "Workflow"}
                  </Text>
                </View>

                <View style={styles.runMeta}>
                  <Text style={[styles.runStatus, { color: c }]}>{t}</Text>
                  <Text style={styles.runDivider}>•</Text>
                  <Text style={styles.runTime}>{timeAgo}</Text>
                  {!!run.head_branch && (
                    <>
                      <Text style={styles.runDivider}>•</Text>
                      <Text style={styles.runBranch} numberOfLines={1}>
                        {run.head_branch}
                      </Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          {moreCount > 0 && (
            <Text style={styles.moreText}>+ {moreCount} weitere Runs</Text>
          )}
        </View>
      )}

      {runs.length === 0 && !loadingRuns && !error && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            Trage ein Repo (owner/repo) ein, um Workflow Runs zu laden.
          </Text>
        </View>
      )}
    </View>
  );
}
