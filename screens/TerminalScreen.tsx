import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTerminal } from '../contexts/TerminalContext';
import { theme } from '../theme';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

type LogType = 'log' | 'warn' | 'error';

const getLogTypeLabel = (type: LogType): string => {
  switch (type) {
    case 'warn':
      return 'WARN';
    case 'error':
      return 'ERROR';
    default:
      return 'LOG';
  }
};

// Memoize log item to prevent unnecessary re-renders
const LogItem = React.memo(({ log }: { log: any }) => {
  const getLogStyle = (type: LogType) => {
    switch (type) {
      case 'warn':
        return { color: theme.palette.warning, badge: styles.warnBadge };
      case 'error':
        return { color: theme.palette.error, badge: styles.errorBadge };
      default:
        return { color: theme.palette.text.primary, badge: styles.logBadge };
    }
  };

  const logStyle = getLogStyle(log.type);

  return (
    <View style={styles.logEntry}>
      <View style={styles.logHeader}>
        <View style={[styles.badge, logStyle.badge]}>
          <Text style={styles.badgeText}>{getLogTypeLabel(log.type)}</Text>
        </View>
        <Text style={styles.timestamp}>{log.timestamp}</Text>
      </View>
      <Text style={[styles.logText, { color: logStyle.color }]} numberOfLines={10}>
        {log.message}
      </Text>
    </View>
  );
});

LogItem.displayName = 'LogItem';

const TerminalScreen = () => {
  const { logs, clearLogs } = useTerminal();

  const logStats = useMemo(() => {
    const errors = logs.filter((l) => l.type === 'error').length;
    const warnings = logs.filter((l) => l.type === 'warn').length;
    const info = logs.filter((l) => l.type === 'log').length;
    return { errors, warnings, info, total: logs.length };
  }, [logs]);

  const copyLogsToClipboard = useCallback(() => {
    const logString = logs
      .slice()
      .reverse()
      .map((log) => `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`)
      .join('\n');

    Clipboard.setStringAsync(logString);
    Alert.alert('✅ Logs kopiert', 'Alle Terminal-Logs wurden in die Zwischenablage kopiert.');
  }, [logs]);

  const renderItem = useCallback(
    ({ item }: { item: any }) => <LogItem log={item} />,
    []
  );

  const keyExtractor = useCallback((item: any) => item.id.toString(), []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Ionicons name="terminal" size={24} color={theme.palette.primary} style={styles.titleIcon} />
          <View>
            <Text style={styles.title}>Terminal</Text>
            <Text style={styles.stats}>
              {logStats.total} logs • {logStats.errors} errors • {logStats.warnings} warnings
            </Text>
          </View>
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={copyLogsToClipboard}
            style={[styles.headerButton, styles.copyButton]}
            disabled={logs.length === 0}
          >
            <Ionicons
              name="copy-outline"
              size={22}
              color={logs.length === 0 ? theme.palette.text.disabled : theme.palette.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={clearLogs}
            style={[styles.headerButton, styles.clearButton]}
            disabled={logs.length === 0}
          >
            <Ionicons
              name="trash-outline"
              size={22}
              color={logs.length === 0 ? theme.palette.text.disabled : theme.palette.error}
            />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={logs}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        style={styles.container}
        contentContainerStyle={styles.listContent}
        inverted
        removeClippedSubviews={true}
        maxToRenderPerBatch={20}
        windowSize={21}
        initialNumToRender={15}
        updateCellsBatchingPeriod={50}
        getItemLayout={(data, index) => ({
          length: 100,
          offset: 100 * index,
          index,
        })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="code-slash-outline" size={48} color={theme.palette.text.disabled} />
            <Text style={styles.emptyText}>Keine Logs vorhanden</Text>
            <Text style={styles.emptySubtext}>Console-Logs werden hier angezeigt</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0e14',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#151a21',
    borderBottomWidth: 2,
    borderBottomColor: theme.palette.primary + '33',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleIcon: {
    marginRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.palette.text.primary,
    letterSpacing: 0.5,
  },
  stats: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: theme.palette.card,
  },
  copyButton: {
    borderWidth: 1,
    borderColor: theme.palette.primary + '44',
  },
  clearButton: {
    borderWidth: 1,
    borderColor: theme.palette.error + '44',
  },
  listContent: {
    padding: 12,
    paddingBottom: 20,
  },
  logEntry: {
    backgroundColor: '#151a21',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: theme.palette.primary,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 8,
  },
  logBadge: {
    backgroundColor: theme.palette.primary + '22',
  },
  warnBadge: {
    backgroundColor: theme.palette.warning + '22',
  },
  errorBadge: {
    backgroundColor: theme.palette.error + '22',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.palette.text.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timestamp: {
    color: theme.palette.text.disabled,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: theme.palette.text.disabled,
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 13,
    color: theme.palette.text.disabled,
    opacity: 0.7,
  },
});

export default TerminalScreen;
