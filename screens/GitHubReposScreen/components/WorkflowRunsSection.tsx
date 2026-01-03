import React, { memo, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Linking,
} from "react-native";
import { theme } from "../../../theme";
import { WorkflowRun } from "../../../hooks/useGitHubRepos";

interface WorkflowRunsSectionProps {
  activeRepo: string | null;
  loadWorkflowRuns: (
    owner: string,
    repo: string,
    perPage?: number,
  ) => Promise<WorkflowRun[]>;
}

const STATUS_ICONS: Record<string, string> = {
  completed: "✅",
  in_progress: "🔄",
  queued: "⏳",
  waiting: "⏸️",
};

const CONCLUSION_ICONS: Record<string, string> = {
  success: "✅",
  failure: "❌",
  cancelled: "🚫",
  skipped: "⏭️",
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "gerade eben";
  if (diffMins < 60) return `vor ${diffMins}m`;
  if (diffHours < 24) return `vor ${diffHours}h`;
  if (diffDays < 7) return `vor ${diffDays}d`;

  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
  });
};

export const WorkflowRunsSection = memo(function WorkflowRunsSection({
  activeRepo,
  loadWorkflowRuns,
}: WorkflowRunsSectionProps) {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadRuns = useCallback(async () => {
    if (!activeRepo) {
      setRuns([]);
      return;
    }

    const [owner, repo] = activeRepo.split("/");
    if (!owner || !repo) return;

    setLoading(true);
    try {
      const result = await loadWorkflowRuns(owner, repo, 8);
      setRuns(result);
    } catch (e) {
      console.error("[WorkflowRunsSection] Fehler:", e);
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [activeRepo, loadWorkflowRuns]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const openInBrowser = useCallback((url: string) => {
    Linking.openURL(url).catch((e) => {
      console.error("[WorkflowRunsSection] Fehler beim Öffnen:", e);
    });
  }, []);

  if (!activeRepo) {
    return null;
  }

  const getStatusDisplay = (run: WorkflowRun) => {
    if (run.status === "completed" && run.conclusion) {
      return CONCLUSION_ICONS[run.conclusion] || "❓";
    }
    return STATUS_ICONS[run.status] || "❓";
  };

  const getStatusColor = (run: WorkflowRun): string => {
    if (run.status === "completed") {
      if (run.conclusion === "success") return theme.palette.success;
      if (run.conclusion === "failure") return theme.palette.error;
      return theme.palette.text.secondary;
    }
    if (run.status === "in_progress") return theme.palette.warning;
    return theme.palette.text.secondary;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>⚡ GitHub Actions</Text>
          {loading && (
            <ActivityIndicator
              size="small"
              color={theme.palette.primary}
              style={styles.loader}
            />
          )}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={loadRuns}
            style={styles.refreshButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.refreshText}>🔄</Text>
          </TouchableOpacity>
          <Text style={styles.chevron}>{expanded ? "▲" : "▼"}</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.runsList}>
          {runs.length === 0 && !loading && (
            <Text style={styles.emptyText}>Keine Workflow Runs gefunden</Text>
          )}

          {runs.map((run) => (
            <TouchableOpacity
              key={run.id}
              style={styles.runItem}
              onPress={() => openInBrowser(run.html_url)}
              activeOpacity={0.7}
            >
              <View style={styles.runLeft}>
                <Text style={styles.statusIcon}>{getStatusDisplay(run)}</Text>
                <View style={styles.runInfo}>
                  <Text style={styles.runName} numberOfLines={1}>
                    {run.name}
                  </Text>
                  <Text style={styles.runMeta}>
                    #{run.run_number} • {run.head_branch} •{" "}
                    {formatDate(run.updated_at)}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(run) + "20" },
                ]}
              >
                <Text
                  style={[styles.statusText, { color: getStatusColor(run) }]}
                >
                  {run.status === "completed"
                    ? run.conclusion || "–"
                    : run.status}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          {runs.length > 0 && (
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() =>
                openInBrowser(`https://github.com/${activeRepo}/actions`)
              }
            >
              <Text style={styles.viewAllText}>
                Alle Actions auf GitHub öffnen →
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.palette.text.primary,
  },
  loader: {
    marginLeft: 8,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  refreshButton: {
    padding: 4,
  },
  refreshText: {
    fontSize: 16,
  },
  chevron: {
    fontSize: 10,
    color: theme.palette.text.secondary,
  },
  runsList: {
    marginTop: 12,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    textAlign: "center",
    paddingVertical: 16,
  },
  runItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: 8,
    backgroundColor: theme.palette.background,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  runLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  statusIcon: {
    fontSize: 18,
  },
  runInfo: {
    flex: 1,
  },
  runName: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.palette.text.primary,
  },
  runMeta: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  viewAllButton: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
  },
  viewAllText: {
    fontSize: 13,
    color: theme.palette.primary,
    fontWeight: "600",
  },
});
