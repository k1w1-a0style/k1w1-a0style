import React, { useMemo } from "react";
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { cacheDirectory, writeAsStringAsync, EncodingType } from "expo-file-system";
import * as Sharing from "expo-sharing";

import {
  formatDuration,
  formatRelativeTime,
  getStatusIcon,
} from "../../../utils/buildScreenUtils";
import { styles } from "../../../styles/enhancedBuildScreenStyles";
import type { BuildHistoryEntry } from "../../../shared/types/build";

type HistoryFilter = "all" | "development" | "preview" | "production";

type BuildHistoryStats = {
  total: number;
  success: number;
  failed: number;
  building: number;
};

type BuildHistorySectionProps = {
  historyLoading: boolean;
  stats: BuildHistoryStats;
  history: BuildHistoryEntry[];
  clearHistory: () => void;
  deleteEntry: (jobId: string) => void;
  openRun: (url: string) => void;
  historyFilter: HistoryFilter;
  setHistoryFilter: (v: HistoryFilter) => void;
};

export function BuildHistorySection({
  historyLoading,
  stats,
  history,
  clearHistory,
  deleteEntry,
  openRun,
  historyFilter,
  setHistoryFilter,
}: BuildHistorySectionProps): React.ReactElement {
  const grouped = useMemo(() => {
    const counts: Record<string, number> = { development: 0, preview: 0, production: 0 };
    for (const h of history) {
      const p = String(h.buildProfile || "").toLowerCase();
      if (p in counts) counts[p] += 1;
    }
    return counts;
  }, [history]);

  const copyJson = async () => {
    try {
      const json = JSON.stringify(history, null, 2);
      await Clipboard.setStringAsync(json);
    } catch {
      // ignore
    }
  };

  const escapeCsv = (v: unknown) => {
    const s = String(v ?? "");
    const needs = /[\n\r\t,\"]/g.test(s);
    const safe = s.replace(/\"/g, '""');
    return needs ? `"${safe}"` : safe;
  };

  const shareCsv = async () => {
    try {
      const headers = [
        "jobId",
        "repoName",
        "status",
        "buildProfile",
        "startedAt",
        "completedAt",
        "durationMs",
        "htmlUrl",
        "artifactUrl",
        "errorMessage",
      ] satisfies Array<keyof BuildHistoryEntry>;
      const rows = history.map((h) =>
        headers
          .map((k) => escapeCsv(h?.[k]))
          .join(","),
      );
      const csv = [headers.join(","), ...rows].join("\n");
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const suffix = historyFilter === "all" ? "all" : historyFilter;
      const fileUri = `${cacheDirectory}build-history-${suffix}-${ts}.csv`;
      await writeAsStringAsync(fileUri, csv, { encoding: EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: "text/csv" });
      }
    } catch {
      // ignore
    }
  };

  const confirmClear = () => {
    Alert.alert("Historie leeren?", "Nur die lokale Historie wird gelöscht.", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Leeren", style: "destructive", onPress: clearHistory },
    ]);
  };

  const confirmDelete = (jobId: string) => {
    Alert.alert("Eintrag löschen?", `Build #${jobId} aus der Historie entfernen?`, [
      { text: "Abbrechen", style: "cancel" },
      { text: "Löschen", style: "destructive", onPress: () => deleteEntry(jobId) },
    ]);
  };

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

          <View style={{ gap: 10, marginTop: 8 }}>
            <TouchableOpacity
              style={[styles.primaryBtn, styles.historyBtnSpacing]}
              onPress={confirmClear}
              accessibilityLabel="Build-Historie leeren"
            >
              <Text style={styles.primaryBtnText}>🗑️ Historie leeren</Text>
            </TouchableOpacity>

            {history.length > 0 && (
              <View style={styles.filterRow}>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={copyJson}
                  activeOpacity={0.8}
                  accessibilityLabel="Historie als JSON kopieren"
                >
                  <Text style={styles.secondaryBtnText}>📋 Copy JSON</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={shareCsv}
                  activeOpacity={0.8}
                  accessibilityLabel="Historie als CSV teilen"
                >
                  <Text style={styles.secondaryBtnText}>📤 Share CSV</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.filterRow}>
            {([
              ["all", "Alle"],
              ["development", "Dev"],
              ["preview", "Preview"],
              ["production", "Prod"],
            ] as const).map(([k, label]) => {
              const active = historyFilter === k;
              return (
                <TouchableOpacity
                  key={k}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                  onPress={() => setHistoryFilter(k)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {history.length > 0 && (
            <View style={styles.runList}>
              {historyFilter === "all" && (grouped.development + grouped.preview + grouped.production) > 0 && (
                <View style={{ marginBottom: 10 }}>
                  <Text style={styles.moreText}>
                    Dev: {grouped.development} • Preview: {grouped.preview} • Prod: {grouped.production}
                  </Text>
                </View>
              )}
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
                    <View style={[styles.runMeta, { justifyContent: "space-between", marginTop: 10 }]}>
                      {!!h.htmlUrl && (
                        <TouchableOpacity
                          onPress={() => openRun(h.htmlUrl || "")}
                          activeOpacity={0.7}
                          style={styles.historyLink}
                        >
                          <Text style={styles.moreText}>↗️ GitHub öffnen</Text>
                        </TouchableOpacity>
                      )}
                      {!!h.jobId && (
                        <TouchableOpacity
                          onPress={() => confirmDelete(String(h.jobId))}
                          activeOpacity={0.75}
                          style={[styles.historyLink, { marginLeft: "auto" }]}
                          accessibilityLabel="Historie-Eintrag löschen"
                        >
                          <Text style={styles.moreText}>🗑️</Text>
                        </TouchableOpacity>
                      )}
                    </View>
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
