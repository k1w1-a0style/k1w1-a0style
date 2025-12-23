import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Animated, FlatList } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { zip } from "react-native-zip-archive";

import { useTerminal, LogEntry } from "../../../contexts/TerminalContext";
import { useProject } from "../../../contexts/ProjectContext";
import type { Filter } from "../types";
import { getLogLabel } from "../utils/logPresentation";

export function useTerminalScreen() {
  const navigation = useNavigation();
  const { triggerAutoFix } = useProject();

  const {
    logs,
    clearLogs,
    getLogStats,
    isConsoleOverrideEnabled,
    setConsoleOverride,
  } = useTerminal();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  const [autoScroll, setAutoScroll] = useState(true);

  const flatListRef = useRef<FlatList<LogEntry>>(null);

  // fancy search reveal (optional)
  const searchAnim = useRef(new Animated.Value(1)).current;

  const stats = getLogStats();

  const filteredLogs = useMemo(() => {
    let list = logs;

    if (activeFilter !== "all") {
      list = list.filter((l) => l.type === activeFilter);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (l) =>
          l.message.toLowerCase().includes(q) ||
          l.timestamp.toLowerCase().includes(q) ||
          l.type.toLowerCase().includes(q),
      );
    }

    return list;
  }, [logs, activeFilter, searchQuery]);

  const toText = useCallback((list: LogEntry[]) => {
    return list
      .slice()
      .reverse()
      .map((l) => `[${l.timestamp}] [${getLogLabel(l.type)}] ${l.message}`)
      .join("\n");
  }, []);

  const confirmClear = useCallback(() => {
    Alert.alert("Logs löschen", "Wirklich alle Logs löschen?", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Löschen", style: "destructive", onPress: clearLogs },
    ]);
  }, [clearLogs]);

  const copyVisibleLogs = useCallback(async () => {
    if (filteredLogs.length === 0) {
      Alert.alert("Hinweis", "Keine Logs zum Kopieren.");
      return;
    }
    await Clipboard.setStringAsync(toText(filteredLogs));
    Alert.alert("✅ Kopiert", `${filteredLogs.length} Logs in Zwischenablage.`);
  }, [filteredLogs, toText]);

  const shareVisibleLogsTxt = useCallback(async () => {
    if (filteredLogs.length === 0) {
      Alert.alert("Hinweis", "Keine Logs zum Exportieren.");
      return;
    }

    try {
      const uri = `${FileSystem.documentDirectory}terminal_logs_${Date.now()}.txt`;
      await FileSystem.writeAsStringAsync(uri, toText(filteredLogs), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Export", `Datei gespeichert:\n${uri}`);
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "text/plain",
        dialogTitle: "Terminal Logs teilen",
      });
    } catch (e) {
      console.error("[TerminalScreen] shareVisibleLogsTxt failed", e);
      Alert.alert("Fehler", "TXT Export fehlgeschlagen.");
    }
  }, [filteredLogs, toText]);

  const exportDebugZip = useCallback(async () => {
    if (filteredLogs.length === 0) {
      Alert.alert("Hinweis", "Keine Logs zum Debug-Dump.");
      return;
    }

    try {
      const baseDir = `${FileSystem.cacheDirectory}debug_dump_${Date.now()}`;
      await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });

      const logsTxt = `${baseDir}/terminal_logs.txt`;
      const statsJson = `${baseDir}/terminal_stats.json`;
      const metaJson = `${baseDir}/meta.json`;

      await FileSystem.writeAsStringAsync(logsTxt, toText(filteredLogs), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await FileSystem.writeAsStringAsync(
        statsJson,
        JSON.stringify(stats, null, 2),
        {
          encoding: FileSystem.EncodingType.UTF8,
        },
      );

      await FileSystem.writeAsStringAsync(
        metaJson,
        JSON.stringify(
          {
            createdAt: new Date().toISOString(),
            filter: activeFilter,
            searchQuery,
            visibleCount: filteredLogs.length,
            consoleOverride: isConsoleOverrideEnabled,
          },
          null,
          2,
        ),
        { encoding: FileSystem.EncodingType.UTF8 },
      );

      const zipPath = `${FileSystem.documentDirectory}debug_dump_${Date.now()}.zip`;
      await zip(baseDir, zipPath);

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Debug ZIP", `ZIP gespeichert:\n${zipPath}`);
        return;
      }

      await Sharing.shareAsync(zipPath, {
        mimeType: "application/zip",
        dialogTitle: "Debug Dump ZIP teilen",
      });
    } catch (e) {
      console.error("[TerminalScreen] exportDebugZip failed", e);
      Alert.alert("Fehler", "Debug ZIP Export fehlgeschlagen.");
    }
  }, [
    filteredLogs,
    toText,
    stats,
    activeFilter,
    searchQuery,
    isConsoleOverrideEnabled,
  ]);

  const sendLogsToAiAutoFix = useCallback(() => {
    if (filteredLogs.length === 0) {
      Alert.alert("Hinweis", "Keine Logs zum Analysieren.");
      return;
    }

    const payload =
      `🧠 Terminal Log Analyse (Auto-Fix)\n\n` +
      `Filter: ${activeFilter}\n` +
      `Suche: ${searchQuery || "-"}\n` +
      `Visible Logs: ${filteredLogs.length}\n\n` +
      `--- LOGS START ---\n` +
      toText(filteredLogs).slice(-15000) +
      `\n--- LOGS END ---\n\n` +
      `Bitte:\n` +
      `1) Erkläre die wahrscheinlichste Ursache.\n` +
      `2) Nenne die betroffenen Dateien/Module.\n` +
      `3) Gib einen Fix als vollständige Dateien (rm -f && nano ...).\n` +
      `4) Nenne Tests/Checks danach.\n`;

    triggerAutoFix(payload);
    navigation.navigate("Home" as never);

    Alert.alert(
      "🤖 Auto-Fix gestartet",
      "Die KI analysiert die Logs im Chat und liefert Fix-Dateien.",
      [{ text: "OK" }],
    );
  }, [
    filteredLogs,
    toText,
    activeFilter,
    searchQuery,
    triggerAutoFix,
    navigation,
  ]);

  const onContentSizeChange = useCallback(() => {
    if (!autoScroll) return;
    if (flatListRef.current && filteredLogs.length > 0) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, [autoScroll, filteredLogs.length]);

  return {
    logs,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    autoScroll,
    setAutoScroll,
    flatListRef,
    searchAnim,
    stats,
    filteredLogs,
    isConsoleOverrideEnabled,
    setConsoleOverride,
    confirmClear,
    copyVisibleLogs,
    shareVisibleLogsTxt,
    exportDebugZip,
    sendLogsToAiAutoFix,
    onContentSizeChange,
  };
}
