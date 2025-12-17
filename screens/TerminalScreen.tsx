import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Animated,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { zip } from 'react-native-zip-archive';
import { useNavigation } from '@react-navigation/native';

import { theme } from '../theme';
import { useTerminal, LogEntry } from '../contexts/TerminalContext';
import { useProject } from '../contexts/ProjectContext';

type LogType = 'log' | 'warn' | 'error';
type Filter = LogType | 'all';

const getLogLabel = (type: LogType) => (type === 'log' ? 'INFO' : type.toUpperCase());

const getLogIcon = (type: LogType): keyof typeof Ionicons.glyphMap => {
  switch (type) {
    case 'warn':
      return 'warning';
    case 'error':
      return 'close-circle';
    default:
      return 'information-circle';
  }
};

const getLogColor = (type: LogType) => {
  switch (type) {
    case 'warn':
      return theme.palette.warning;
    case 'error':
      return theme.palette.error;
    default:
      return theme.palette.primary;
  }
};

export default function TerminalScreen() {
  const navigation = useNavigation();
  const { triggerAutoFix } = useProject();

  const {
    logs,
    clearLogs,
    getLogStats,
    isConsoleOverrideEnabled,
    setConsoleOverride,
  } = useTerminal();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [autoScroll, setAutoScroll] = useState(true);

  const flatListRef = useRef<FlatList<LogEntry>>(null);

  // fancy search reveal (optional)
  const searchAnim = useRef(new Animated.Value(1)).current;

  const stats = getLogStats();

  const filteredLogs = useMemo(() => {
    let list = logs;

    if (activeFilter !== 'all') {
      list = list.filter((l) => l.type === activeFilter);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (l) =>
          l.message.toLowerCase().includes(q) ||
          l.timestamp.toLowerCase().includes(q) ||
          l.type.toLowerCase().includes(q)
      );
    }

    return list;
  }, [logs, activeFilter, searchQuery]);

  const toText = useCallback((list: LogEntry[]) => {
    return list
      .slice()
      .reverse()
      .map((l) => `[${l.timestamp}] [${getLogLabel(l.type)}] ${l.message}`)
      .join('\n');
  }, []);

  const confirmClear = useCallback(() => {
    Alert.alert('Logs löschen', 'Wirklich alle Logs löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: clearLogs },
    ]);
  }, [clearLogs]);

  const copyVisibleLogs = useCallback(async () => {
    if (filteredLogs.length === 0) {
      Alert.alert('Hinweis', 'Keine Logs zum Kopieren.');
      return;
    }
    await Clipboard.setStringAsync(toText(filteredLogs));
    Alert.alert('✅ Kopiert', `${filteredLogs.length} Logs in Zwischenablage.`);
  }, [filteredLogs, toText]);

  const shareVisibleLogsTxt = useCallback(async () => {
    if (filteredLogs.length === 0) {
      Alert.alert('Hinweis', 'Keine Logs zum Exportieren.');
      return;
    }

    try {
      const uri = `${FileSystem.documentDirectory}terminal_logs_${Date.now()}.txt`;
      await FileSystem.writeAsStringAsync(uri, toText(filteredLogs), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Export', `Datei gespeichert:\n${uri}`);
        return;
      }

      await Sharing.shareAsync(uri, { mimeType: 'text/plain', dialogTitle: 'Terminal Logs teilen' });
    } catch (e) {
      console.error('[TerminalScreen] shareVisibleLogsTxt failed', e);
      Alert.alert('Fehler', 'TXT Export fehlgeschlagen.');
    }
  }, [filteredLogs, toText]);

  const exportDebugZip = useCallback(async () => {
    if (filteredLogs.length === 0) {
      Alert.alert('Hinweis', 'Keine Logs zum Debug-Dump.');
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
        { encoding: FileSystem.EncodingType.UTF8 }
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
          2
        ),
        { encoding: FileSystem.EncodingType.UTF8 }
      );

      const zipPath = `${FileSystem.documentDirectory}debug_dump_${Date.now()}.zip`;
      await zip(baseDir, zipPath);

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Debug ZIP', `ZIP gespeichert:\n${zipPath}`);
        return;
      }

      await Sharing.shareAsync(zipPath, {
        mimeType: 'application/zip',
        dialogTitle: 'Debug Dump ZIP teilen',
      });
    } catch (e) {
      console.error('[TerminalScreen] exportDebugZip failed', e);
      Alert.alert('Fehler', 'Debug ZIP Export fehlgeschlagen.');
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
      Alert.alert('Hinweis', 'Keine Logs zum Analysieren.');
      return;
    }

    const payload =
      `🧠 Terminal Log Analyse (Auto-Fix)\n\n` +
      `Filter: ${activeFilter}\n` +
      `Suche: ${searchQuery || '-'}\n` +
      `Visible Logs: ${filteredLogs.length}\n\n` +
      `--- LOGS START ---\n` +
      toText(filteredLogs).slice(-15000) + // safety limit
      `\n--- LOGS END ---\n\n` +
      `Bitte:\n` +
      `1) Erkläre die wahrscheinlichste Ursache.\n` +
      `2) Nenne die betroffenen Dateien/Module.\n` +
      `3) Gib einen Fix als vollständige Dateien (rm -f && nano ...).\n` +
      `4) Nenne Tests/Checks danach.\n`;

    triggerAutoFix(payload);
    navigation.navigate('Home' as never);

    Alert.alert(
      '🤖 Auto-Fix gestartet',
      'Die KI analysiert die Logs im Chat und liefert Fix-Dateien.',
      [{ text: 'OK' }]
    );
  }, [filteredLogs, toText, activeFilter, searchQuery, triggerAutoFix, navigation]);

  const renderItem = ({ item }: { item: LogEntry }) => {
    const icon = getLogIcon(item.type);
    const color = getLogColor(item.type);

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onLongPress={async () => {
          await Clipboard.setStringAsync(
            `[${item.timestamp}] [${getLogLabel(item.type)}] ${item.message}`
          );
          Alert.alert('✅ Kopiert', 'Log-Zeile kopiert.');
        }}
        style={styles.logRow}
      >
        <View style={styles.logMeta}>
          <Ionicons name={icon} size={16} color={color} />
          <Text style={styles.logTime}>{item.timestamp}</Text>
          <Text style={[styles.logType, { color }]}>{getLogLabel(item.type)}</Text>
        </View>
        <Text style={styles.logMessage}>{item.message}</Text>
      </TouchableOpacity>
    );
  };

  const onContentSizeChange = useCallback(() => {
    if (!autoScroll) return;
    if (flatListRef.current && filteredLogs.length > 0) {
      // logs are stored newest-first (context pushes to top), so scroll to top for "latest"
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, [autoScroll, filteredLogs.length]);

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom','left','right']}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>Terminal</Text>

        <View style={styles.headerRight}>
          <TouchableOpacity onPress={sendLogsToAiAutoFix} style={styles.headerBtn}>
            <Ionicons name="sparkles-outline" size={18} color={theme.palette.text.primary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={exportDebugZip} style={styles.headerBtn}>
            <Ionicons name="archive-outline" size={18} color={theme.palette.text.primary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={shareVisibleLogsTxt} style={styles.headerBtn}>
            <Ionicons name="share-outline" size={18} color={theme.palette.text.primary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={confirmClear} style={styles.headerBtn}>
            <Ionicons name="trash-outline" size={18} color={theme.palette.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* CONSOLE OVERRIDE TOGGLE + STATS */}
      <View style={styles.topBox}>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Console Override</Text>
            <Text style={styles.toggleHint}>console.log/warn/error → Terminal</Text>
          </View>
          <Switch value={isConsoleOverrideEnabled} onValueChange={setConsoleOverride} />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Text style={styles.statLabel}>Total</Text>
            <Text style={styles.statValue}>{stats.total}</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statLabel}>Warn</Text>
            <Text style={styles.statValue}>{stats.warnings}</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statLabel}>Err</Text>
            <Text style={styles.statValue}>{stats.errors}</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statLabel}>Auto</Text>
            <Text style={styles.statValue}>{autoScroll ? 'ON' : 'OFF'}</Text>
          </View>
        </View>
      </View>

      {/* FILTERS */}
      <View style={styles.filters}>
        {(['all', 'log', 'warn', 'error'] as Filter[]).map((t) => {
          const active = activeFilter === t;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => setActiveFilter(t)}
              style={[styles.filterBtn, active && styles.filterBtnActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {t.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}

        <View style={styles.autoScrollRow}>
          <Text style={styles.autoScrollLabel}>Auto-Scroll</Text>
          <Switch value={autoScroll} onValueChange={setAutoScroll} />
        </View>
      </View>

      {/* SEARCH */}
      <Animated.View style={{ opacity: searchAnim }}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={theme.palette.text.secondary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Suche in Logs..."
            placeholderTextColor={theme.palette.text.secondary}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.headerBtn}>
              <Ionicons name="close-circle" size={18} color={theme.palette.text.secondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={copyVisibleLogs} style={styles.headerBtn}>
            <Ionicons name="copy-outline" size={18} color={theme.palette.text.secondary} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* LIST */}
      <FlatList
        ref={flatListRef}
        data={filteredLogs}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        onContentSizeChange={onContentSizeChange}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Keine Logs vorhanden oder Filter aktiv.</Text>
            <Text style={styles.emptyHint}>
              Tipp: Console Override aktivieren + irgendwas ausführen (Build/Chat/Import).
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.palette.background },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.palette.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: theme.palette.text.primary },
  headerRight: { flexDirection: 'row', gap: 8 },
  headerBtn: { padding: 6 },

  topBox: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.palette.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    gap: 10,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleTitle: { fontWeight: '800', color: theme.palette.text.primary },
  toggleHint: { fontSize: 12, color: theme.palette.text.secondary },

  statsRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  statChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
    alignItems: 'center',
  },
  statLabel: { fontSize: 10, fontWeight: '700', color: theme.palette.text.secondary },
  statValue: { fontSize: 14, fontWeight: '900', color: theme.palette.text.primary },

  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  filterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  filterBtnActive: { borderColor: theme.palette.primary },
  filterText: { fontSize: 12, fontWeight: '800', color: theme.palette.text.secondary },
  filterTextActive: { color: theme.palette.primary },

  autoScrollRow: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 10,
  },
  autoScrollLabel: { fontSize: 12, fontWeight: '700', color: theme.palette.text.secondary },

  searchRow: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: theme.palette.text.primary },

  list: { paddingHorizontal: 16, paddingBottom: 80 },

  logRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  logMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  logTime: { fontSize: 12, color: theme.palette.text.secondary },
  logType: { fontSize: 12, fontWeight: '900' },
  logMessage: { fontSize: 13, lineHeight: 18, color: theme.palette.text.primary },

  empty: { paddingTop: 40, alignItems: 'center' },
  emptyText: { textAlign: 'center', color: theme.palette.text.secondary },
  emptyHint: { marginTop: 8, fontSize: 12, color: theme.palette.text.secondary },
});
