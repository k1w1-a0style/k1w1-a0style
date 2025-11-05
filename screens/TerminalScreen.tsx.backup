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
        return styles.warnText;
      case 'error':
        return styles.errorText;
      default:
        return styles.logText;
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
        <Text style={styles.title}>Terminal</Text>
        <View style={styles.buttonContainer}>
          <TouchableOpacity onPress={copyLogsToClipboard} style={styles.headerButton}>
            <Ionicons name="copy-outline" size={24} color={theme.palette.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={clearLogs} style={[styles.headerButton, { marginLeft: 10 }]}>
            <Ionicons name="trash-outline" size={24} color={theme.palette.error} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.logEntry}>
            <Text style={styles.timestamp}>{item.timestamp}</Text>
            <Text style={[styles.logText, getLogStyle(item.type)]}>
              {item.message}
            </Text>
          </View>
        )}
        style={styles.container}
        contentContainerStyle={styles.listContent}
        inverted
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.palette.background },
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, backgroundColor: theme.palette.card, borderBottomWidth: 1, borderBottomColor: theme.palette.border },
  title: { fontSize: 18, fontWeight: 'bold', color: theme.palette.text.primary },
  buttonContainer: { flexDirection: 'row' },
  headerButton: { padding: 5 },
  listContent: { padding: 10 },
  logEntry: { flexDirection: 'row', marginBottom: 5, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  timestamp: { color: theme.palette.text.disabled, fontSize: 12, marginRight: 8 },
  logText: { flex: 1, color: theme.palette.text.primary, fontSize: 12, flexWrap: 'wrap' },
  warnText: { color: theme.palette.warning },
  errorText: { color: theme.palette.error },
});

export default TerminalScreen;
