// screens/TerminalScreen.tsx – Best-of-Version (Badges + Layout + Copy-All)
import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

import { useTerminal } from '../contexts/TerminalContext';
import { theme } from '../theme';

// Log-Typ
type LogType = 'log' | 'warn' | 'error';

const TerminalScreen: React.FC = () => {
  const { logs, clearLogs } = useTerminal();

  const copyAllLogs = useCallback(async () => {
    if (!logs.length) return;

    const text = logs
      .slice()
      .reverse() // Älteste zuerst
      .map(
        (log) =>
          `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`,
      )
      .join('\n');

    await Clipboard.setStringAsync(text);
    Alert.alert('Kopiert', 'Alle Terminal-Logs wurden in die Zwischenablage kopiert.');
  }, [logs]);

  const copySingleLog = useCallback(async (logLine: string) => {
    await Clipboard.setStringAsync(logLine);
    Alert.alert('Kopiert', 'Log-Eintrag wurde in die Zwischenablage kopiert.');
  }, []);

  const getLogStyle = (type: LogType) => {
    switch (type) {
      case 'warn':
        return {
          color: theme.palette.warning,
          badgeStyle: styles.warnBadge,
          label: 'WARN',
        };
      case 'error':
        return {
          color: theme.palette.error,
          badgeStyle: styles.errorBadge,
          label: 'ERROR',
        };
      default:
        return {
          color: theme.palette.terminal.text,
          badgeStyle: styles.logBadge,
          label: 'LOG',
        };
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const logType = (item.type || 'log') as LogType;
    const { color, badgeStyle, label } = getLogStyle(logType);
    const line = `[${item.timestamp}] [${logType.toUpperCase()}] ${item.message}`;

    return (
      <TouchableOpacity
        onLongPress={() => copySingleLog(line)}
        activeOpacity={0.7}
        style={styles.logEntry}
      >
        <View style={styles.logHeader}>
          <View style={[styles.badge, badgeStyle]}>
            <Text style={styles.badgeText}>{label}</Text>
          </View>
          <Text style={styles.timestamp}>{item.timestamp}</Text>
        </View>
        <Text
          style={[styles.logText, { color }]}
          selectable
        >
          {item.message}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Ionicons
            name="terminal"
            size={24}
            color={theme.palette.primary}
            style={styles.titleIcon}
          />
          <Text style={styles.title}>Terminal</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={copyAllLogs}
            style={[styles.headerButton, styles.copyButton]}
          >
            <Ionicons
              name="copy-outline"
              size={20}
              color={theme.palette.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={clearLogs}
            style={[styles.headerButton, styles.clearButton]}
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color={theme.palette.error}
            />
          </TouchableOpacity>
        </View>
      </View>

      {logs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="code-slash-outline"
            size={48}
            color={theme.palette.text.disabled}
          />
          <Text style={styles.emptyText}>Keine Logs vorhanden</Text>
          <Text style={styles.emptySubText}>
            Aktionen in der App erzeugen Einträge hier.
          </Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          inverted // Neueste oben
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.palette.terminal.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: theme.palette.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleIcon: {
    marginRight: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.palette.text.primary,
  },
  buttonContainer: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginLeft: 8,
    backgroundColor: theme.palette.background,
  },
  copyButton: {},
  clearButton: {},
  list: {
    flex: 1,
  },
  listContent: {
    padding: 12,
    paddingBottom: 24,
  },
  logEntry: {
    backgroundColor: '#151a21',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  logBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  warnBadge: {
    backgroundColor: 'rgba(255, 204, 0, 0.12)',
  },
  errorBadge: {
    backgroundColor: 'rgba(255, 68, 68, 0.18)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  timestamp: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logText: {
    fontSize: 13,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 15,
    color: theme.palette.text.secondary,
  },
  emptySubText: {
    marginTop: 4,
    fontSize: 12,
    color: theme.palette.text.muted,
    textAlign: 'center',
  },
});

export default TerminalScreen;
