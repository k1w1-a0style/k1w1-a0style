// components/BuildLogViewer.tsx
// Live-Log-Viewer für GitHub Actions mit Auto-Scroll

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { LogLine } from '../contexts/types';

interface BuildLogViewerProps {
  logs: LogLine[];
  maxHeight?: number;
  autoScroll?: boolean;
  showTimestamp?: boolean;
  filterLevel?: 'all' | 'info' | 'warn' | 'error';
}

const BuildLogViewer: React.FC<BuildLogViewerProps> = ({
  logs,
  maxHeight = 300,
  autoScroll = true,
  showTimestamp = true,
  filterLevel = 'all',
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(autoScroll);
  const [isExpanded, setIsExpanded] = useState(true);

  // Filtere Logs nach Level
  const filteredLogs = logs.filter(log => {
    if (filterLevel === 'all') return true;
    if (filterLevel === 'error') return log.level === 'error';
    if (filterLevel === 'warn') return log.level === 'warn' || log.level === 'error';
    return true;
  });

  // Auto-Scroll bei neuen Logs
  useEffect(() => {
    if (isAutoScrollEnabled && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [filteredLogs.length, isAutoScrollEnabled]);

  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '--:--:--';
    }
  };

  const getLevelStyle = (level: LogLine['level']) => {
    switch (level) {
      case 'error':
        return styles.logError;
      case 'warn':
        return styles.logWarn;
      case 'debug':
        return styles.logDebug;
      default:
        return styles.logInfo;
    }
  };

  const getLevelColor = (level: LogLine['level']) => {
    switch (level) {
      case 'error':
        return theme.palette.error;
      case 'warn':
        return theme.palette.warning;
      case 'debug':
        return theme.palette.text.muted;
      default:
        return theme.palette.text.primary;
    }
  };

  if (filteredLogs.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="terminal-outline"
          size={24}
          color={theme.palette.text.muted}
        />
        <Text style={styles.emptyText}>Noch keine Log-Einträge</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => setIsExpanded(!isExpanded)}
        >
          <Ionicons
            name={isExpanded ? 'chevron-down' : 'chevron-forward'}
            size={16}
            color={theme.palette.text.secondary}
          />
          <Text style={styles.headerTitle}>Live-Protokoll</Text>
          <View style={styles.logCountBadge}>
            <Text style={styles.logCountText}>{filteredLogs.length}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              isAutoScrollEnabled && styles.actionButtonActive,
            ]}
            onPress={() => setIsAutoScrollEnabled(!isAutoScrollEnabled)}
          >
            <Ionicons
              name="arrow-down-circle-outline"
              size={16}
              color={
                isAutoScrollEnabled
                  ? theme.palette.primary
                  : theme.palette.text.muted
              }
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Log Content */}
      {isExpanded && (
        <ScrollView
          ref={scrollViewRef}
          style={[styles.logContainer, { maxHeight }]}
          contentContainerStyle={styles.logContent}
          showsVerticalScrollIndicator={true}
          onScrollBeginDrag={() => setIsAutoScrollEnabled(false)}
        >
          {filteredLogs.map((log, index) => (
            <View key={`${log.timestamp}-${index}`} style={styles.logLine}>
              {showTimestamp && (
                <Text style={styles.timestamp}>
                  {formatTimestamp(log.timestamp)}
                </Text>
              )}
              <Text style={[styles.logMessage, getLevelStyle(log.level)]}>
                {log.message}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.palette.terminal.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.terminal.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.terminal.border,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.palette.text.secondary,
    fontFamily: 'monospace',
  },
  logCountBadge: {
    backgroundColor: theme.palette.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  logCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.palette.background,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 4,
    borderRadius: 4,
  },
  actionButtonActive: {
    backgroundColor: 'rgba(0,255,0,0.1)',
  },
  logContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logContent: {
    gap: 4,
  },
  logLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 2,
  },
  timestamp: {
    fontSize: 10,
    color: theme.palette.text.muted,
    fontFamily: 'monospace',
    marginRight: 8,
    minWidth: 60,
  },
  logMessage: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  logInfo: {
    color: theme.palette.terminal.text,
  },
  logWarn: {
    color: theme.palette.terminal.warning,
  },
  logError: {
    color: theme.palette.terminal.error,
  },
  logDebug: {
    color: theme.palette.text.muted,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    color: theme.palette.text.muted,
  },
});

export default BuildLogViewer;
