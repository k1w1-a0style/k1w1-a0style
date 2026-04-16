// screens/TerminalScreen/hooks/useTerminalScreen.ts
// REFACTORED: constants → terminalHelpers.ts

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
import { redactSecrets, truncateWithMarker } from "../../../lib/secretRedaction";

import {
  MAX_CLIPBOARD_LOGS, MAX_EXPORT_LOGS, MAX_AI_LOGS,
  MAX_CLIPBOARD_CHARS, MAX_EXPORT_CHARS, MAX_AI_CHARS,
  formatSanitizedSearchQuery,
  safeDir,
  sanitizeDebugSearchQuery,
} from "./terminalHelpers";
import type { ToTextOptions } from "./terminalHelpers";

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
  const [isExporting, setIsExporting] = useState(false);

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

  const toText = useCallback(
    (list: LogEntry[], opts: ToTextOptions = {}) => {
      const { maxLogs, maxChars, redact = true } = opts;
      const limited = (maxLogs ? list.slice(0, maxLogs) : list)
        .slice()
        .reverse();

      let out = limited
        .map((l) => {
          const msg = redact ? redactSecrets(l.message) : l.message;
          return `[${l.timestamp}] [${getLogLabel(l.type)}] ${msg}`;
        })
        .join("\n");

      if (maxChars) out = truncateWithMarker(out, maxChars);
      return out;
    },
    [],
  );

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

    const text = toText(filteredLogs, {
      maxLogs: MAX_CLIPBOARD_LOGS,
      maxChars: MAX_CLIPBOARD_CHARS,
      redact: true,
    });

    await Clipboard.setStringAsync(text);

    const suffix = filteredLogs.length > MAX_CLIPBOARD_LOGS ? " (gekürzt)" : "";
    Alert.alert("✅ Kopiert", `${Math.min(filteredLogs.length, MAX_CLIPBOARD_LOGS)} Logs in Zwischenablage${suffix}.`);
  }, [filteredLogs, toText]);

  const shareVisibleLogsTxt = useCallback(async () => {
    if (filteredLogs.length === 0) {
      Alert.alert("Hinweis", "Keine Logs zum Exportieren.");
      return;
    }

    if (isExporting) return;
    setIsExporting(true);

    let tempUri: string | null = null;
    try {
      const base = safeDir(FileSystem.cacheDirectory);
      const uri = `${base}terminal_logs_${Date.now()}.txt`;
      tempUri = uri;
      const text = toText(filteredLogs, {
        maxLogs: MAX_EXPORT_LOGS,
        maxChars: MAX_EXPORT_CHARS,
        redact: true,
      });

      await FileSystem.writeAsStringAsync(uri, text, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        throw new Error("Teilen ist auf diesem Gerät nicht verfügbar.");
      }

      await Sharing.shareAsync(uri, {
        mimeType: "text/plain",
        dialogTitle: "Terminal Logs teilen",
      });
    } catch (e) {
      console.error("[TerminalScreen] shareVisibleLogsTxt failed", e);
      Alert.alert("Fehler", "TXT Export fehlgeschlagen.");
    } finally {
      if (tempUri) {
        await FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => undefined);
      }
      setIsExporting(false);
    }
  }, [filteredLogs, toText, isExporting]);

  const exportDebugZip = useCallback(async () => {
    if (filteredLogs.length === 0) {
      Alert.alert("Hinweis", "Keine Logs zum Debug-Dump.");
      return;
    }

    if (isExporting) return;
    setIsExporting(true);

    let baseDir: string | null = null;
    let zipPath: string | null = null;
    try {
      const cacheBase = safeDir(FileSystem.cacheDirectory);
      if (!cacheBase) throw new Error("No cacheDirectory available");

      baseDir = `${cacheBase}debug_dump_${Date.now()}`;
      await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });

      const logsTxt = `${baseDir}/terminal_logs.txt`;
      const statsJson = `${baseDir}/terminal_stats.json`;
      const metaJson = `${baseDir}/meta.json`;

      await FileSystem.writeAsStringAsync(
        logsTxt,
        toText(filteredLogs, {
          maxLogs: MAX_EXPORT_LOGS,
          maxChars: MAX_EXPORT_CHARS,
          redact: true,
        }),
        { encoding: FileSystem.EncodingType.UTF8 },
      );

      await FileSystem.writeAsStringAsync(
        statsJson,
        JSON.stringify(stats, null, 2),
        { encoding: FileSystem.EncodingType.UTF8 },
      );

      await FileSystem.writeAsStringAsync(
        metaJson,
        JSON.stringify(
          {
            createdAt: new Date().toISOString(),
            filter: activeFilter,
            searchQuery: sanitizeDebugSearchQuery(searchQuery),
            visibleCount: filteredLogs.length,
            consoleOverride: isConsoleOverrideEnabled,
            note: "Logs are redacted + truncated for privacy/perf.",
          },
          null,
          2,
        ),
        { encoding: FileSystem.EncodingType.UTF8 },
      );

      zipPath = `${cacheBase}debug_dump_${Date.now()}.zip`;
      await zip(baseDir, zipPath);

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        throw new Error("Teilen ist auf diesem Gerät nicht verfügbar.");
      }

      await Sharing.shareAsync(zipPath, {
        mimeType: "application/zip",
        dialogTitle: "Debug Dump ZIP teilen",
      });
    } catch (e) {
      console.error("[TerminalScreen] exportDebugZip failed", e);
      Alert.alert("Fehler", "Debug ZIP Export fehlgeschlagen.");
    } finally {
      if (baseDir) {
        await FileSystem.deleteAsync(baseDir, { idempotent: true }).catch(() => undefined);
      }
      if (zipPath) {
        await FileSystem.deleteAsync(zipPath, { idempotent: true }).catch(() => undefined);
      }
      setIsExporting(false);
    }
  }, [
    filteredLogs,
    toText,
    stats,
    activeFilter,
    searchQuery,
    isConsoleOverrideEnabled,
    isExporting,
  ]);

  const sendLogsToAiAutoFix = useCallback(() => {
    if (filteredLogs.length === 0) {
      Alert.alert("Hinweis", "Keine Logs zum Analysieren.");
      return;
    }

    const logsText = toText(filteredLogs, {
      maxLogs: MAX_AI_LOGS,
      maxChars: MAX_AI_CHARS,
      redact: true,
    });

    const payload =
      `🧠 Terminal Log Analyse (Auto-Fix)\n\n` +
      `Filter: ${activeFilter}\n` +
      `Suche: ${formatSanitizedSearchQuery(searchQuery)}\n` +
      `Visible Logs: ${filteredLogs.length}\n` +
      `Sent Logs: ${Math.min(filteredLogs.length, MAX_AI_LOGS)} (redacted)\n\n` +
      `--- LOGS START ---\n` +
      logsText +
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
      "Die KI analysiert die Logs im Chat und liefert Fix-Dateien. (Secrets werden redacted)",
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

  const scrollRafRef = useRef<number | null>(null);
  const onContentSizeChange = useCallback(() => {
    if (!autoScroll) return;
    if (filteredLogs.length === 0) return;

    if (scrollRafRef.current != null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
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
    isExporting,
  };
}
