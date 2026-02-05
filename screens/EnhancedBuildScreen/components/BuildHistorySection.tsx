import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import {
  formatDuration,
  formatRelativeTime,
  getStatusIcon,
} from "../../../utils/buildScreenUtils";
import { styles } from "../../../styles/enhancedBuildScreenStyles";

export function BuildHistorySection({
  historyLoading,
  stats,
  history,
  clearHistory,
  openRun,
}: {
  historyLoading: boolean;
  stats: { total: number; success: number; failed: number; building: number };
  history: any[];
  clearHistory: () => void;
  openRun: (url: string) => void;
}): React.ReactElement {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Build-Historie</Text>

      {historyLoading ? (
        <ActivityIndicator color="#00FF00" />
      ) : (
        <>
          <Text style={styles.subtitle}>
            Gesamt: {stats.total} • ✅ {stats.success} • ❌ {stats.failed} • ⏳{" "}
            {stats.building}
          </Text>

          <TouchableOpacity
            style={[styles.primaryBtn, styles.historyBtnSpacing]}
            onPress={clearHistory}
            accessibilityLabel="Build-Historie leeren"
          >
            <Text style={styles.primaryBtnText}>🗑️ Historie leeren</Text>
          </TouchableOpacity>

          {history.length > 0 && (
            <View style={styles.runList}>
              {history.slice(0, 10).map((h) => {
                const icon = getStatusIcon(h.status);
                return (
                  <View key={h.id} style={styles.runItem}>
                    <View style={styles.runHeader}>
                      <Text style={styles.historyIcon}>{icon}</Text>
                      <Text style={styles.runTitle} numberOfLines={1}>
                        #{h.jobId} • {h.repoName}
                      </Text>
                    </View>
                    <View style={styles.runMeta}>
                      <Text style={styles.runTime}>{h.status.toUpperCase()}</Text>
                      {h.buildProfile && (
                        <>
                          <Text style={styles.runDivider}>•</Text>
                          <Text style={styles.runTime}>{h.buildProfile}</Text>
                        </>
                      )}
                      {typeof h.durationMs === "number" && h.durationMs > 0 && (
                        <>
                          <Text style={styles.runDivider}>•</Text>
                          <Text style={styles.runTime}>
                            {formatDuration(h.durationMs)}
                          </Text>
                        </>
                      )}
                      <Text style={styles.runDivider}>•</Text>
                      <Text style={styles.runTime}>
                        {formatRelativeTime(h.startedAt)}
                      </Text>
                    </View>
                    {!!h.htmlUrl && (
                      <TouchableOpacity
                        onPress={() => openRun(h.htmlUrl || "")}
                        activeOpacity={0.7}
                        style={styles.historyLink}
                      >
                        <Text style={styles.moreText}>↗️ GitHub öffnen</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}
    </View>
  );
}
