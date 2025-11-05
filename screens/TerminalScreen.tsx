import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTerminal } from '../contexts/TerminalContext';
import { theme } from '../theme';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

const TerminalScreen = () => {
  const { logs, clearLogs } = useTerminal();

  const getLogStyle = (type: 'log' | 'warn' | 'error') => {
    switch (type) {
      case 'warn':
        return { color: theme.palette.warning, badge: styles.warnBadge };
      case 'error':
        return { color: theme.palette.error, badge: styles.errorBadge };
      default:
        return { color: theme.palette.text.primary, badge: styles.logBadge };
    }
  };

  const getLogTypeLabel = (type: 'log' | 'warn' | 'error') => {
    switch (type) {
      case 'warn':
        return 'WARN';
      case 'error':
        return 'ERROR';
      default:
        return 'LOG';
    }
  };

  const copyLogsToClipboard = () => {
    const logString = logs
      .slice()
      .reverse()
      .map(log => `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`)
      .join('\n');

    Clipboard.setStringAsync(logString);
    Alert.alert("Logs kopiert", "Alle Terminal-Logs wurden in die Zwischenablage kopiert.");
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Ionicons name="terminal" size={24} color={theme.palette.primary} style={styles.titleIcon} />
          <Text style={styles.title}>Terminal</Text>
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity onPress={copyLogsToClipboard} style={[styles.headerButton, styles.copyButton]}>
            <Ionicons name="copy-outline" size={22} color={theme.palette.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={clearLogs} style={[styles.headerButton, styles.clearButton]}>
            <Ionicons name="trash-outline" size={22} color={theme.palette.error} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          const logStyle = getLogStyle(item.type);
          return (
            <View style={styles.logEntry}>
              <View style={styles.logHeader}>
                <View style={[styles.badge, logStyle.badge]}>
                  <Text style={styles.badgeText}>{getLogTypeLabel(item.type)}</Text>
                </View>
                <Text style={styles.timestamp}>{item.timestamp}</Text>
              </View>
              <Text style={[styles.logText, { color: logStyle.color }]}>
                {item.message}
              </Text>
            </View>
          );
        }}
        style={styles.container}
        contentContainerStyle={styles.listContent}
        inverted
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="code-slash-outline" size={48} color={theme.palette.text.disabled} />
            <Text style={styles.emptyText}>Keine Logs vorhanden</Text>
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
});

export default TerminalScreen;
