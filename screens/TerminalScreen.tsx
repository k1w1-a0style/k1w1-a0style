import React, { useCallback, useMemo, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Platform, 
  Alert,
  TextInput,
  Animated,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
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
      return 'INFO';
  }
};

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

// Enhanced Log Item with better visuals and interactions
const LogItem = React.memo(({ 
  log, 
  onPress,
  isExpanded 
}: { 
  log: any; 
  onPress: () => void;
  isExpanded: boolean;
}) => {
  const getLogStyle = (type: LogType) => {
    switch (type) {
      case 'warn':
        return { 
          color: theme.palette.warning, 
          badge: styles.warnBadge,
          border: theme.palette.warning + '44',
          glow: theme.palette.warning + '22',
        };
      case 'error':
        return { 
          color: theme.palette.error, 
          badge: styles.errorBadge,
          border: theme.palette.error + '44',
          glow: theme.palette.error + '22',
        };
      default:
        return { 
          color: theme.palette.text.primary, 
          badge: styles.logBadge,
          border: theme.palette.primary + '33',
          glow: theme.palette.primary + '11',
        };
    }
  };

  const logStyle = getLogStyle(log.type);

  // Try to detect and format JSON
  const formatMessage = (message: string) => {
    try {
      const parsed = JSON.parse(message);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return message;
    }
  };

  const displayMessage = formatMessage(log.message);
  const isJSON = displayMessage !== log.message;

  return (
    <TouchableOpacity 
      style={[styles.logEntry, { borderLeftColor: logStyle.border, backgroundColor: logStyle.glow }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.logHeader}>
        <View style={styles.logHeaderLeft}>
          <Ionicons 
            name={getLogIcon(log.type)} 
            size={16} 
            color={logStyle.color} 
            style={styles.logIcon}
          />
          <View style={[styles.badge, logStyle.badge]}>
            <Text style={[styles.badgeText, { color: logStyle.color }]}>
              {getLogTypeLabel(log.type)}
            </Text>
          </View>
          <Text style={styles.timestamp}>{log.timestamp}</Text>
        </View>
        {isJSON && (
          <View style={styles.jsonBadge}>
            <Text style={styles.jsonBadgeText}>JSON</Text>
          </View>
        )}
      </View>
      <Text 
        style={[styles.logText, { color: logStyle.color }]} 
        numberOfLines={isExpanded ? undefined : 4}
        selectable={isExpanded}
      >
        {displayMessage}
      </Text>
      {!isExpanded && displayMessage.length > 200 && (
        <View style={styles.expandHint}>
          <Text style={styles.expandHintText}>Tippen zum Erweitern...</Text>
          <Ionicons name="chevron-down" size={12} color={theme.palette.text.disabled} />
        </View>
      )}
    </TouchableOpacity>
  );
});

LogItem.displayName = 'LogItem';

// Filter chip component
const FilterChip = React.memo(({ 
  label, 
  active, 
  onPress, 
  count,
  icon,
  color 
}: { 
  label: string; 
  active: boolean; 
  onPress: () => void; 
  count: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) => (
  <TouchableOpacity 
    style={[
      styles.filterChip, 
      active && { backgroundColor: color + '22', borderColor: color + '66' }
    ]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Ionicons name={icon} size={14} color={active ? color : theme.palette.text.disabled} />
    <Text style={[styles.filterChipText, active && { color }]}>
      {label}
    </Text>
    <View style={[styles.countBadge, active && { backgroundColor: color + '33' }]}>
      <Text style={[styles.countBadgeText, active && { color }]}>
        {count}
      </Text>
    </View>
  </TouchableOpacity>
));

FilterChip.displayName = 'FilterChip';

const TerminalScreen = () => {
  const { logs, clearLogs } = useTerminal();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<LogType | 'all'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  
  // Animation for search bar
  const searchBarHeight = useRef(new Animated.Value(0)).current;
  const [searchVisible, setSearchVisible] = useState(false);

  const logStats = useMemo(() => {
    const errors = logs.filter((l) => l.type === 'error').length;
    const warnings = logs.filter((l) => l.type === 'warn').length;
    const info = logs.filter((l) => l.type === 'log').length;
    return { errors, warnings, info, total: logs.length };
  }, [logs]);

  // Filter and search logs
  const filteredLogs = useMemo(() => {
    let filtered = logs;
    
    // Apply type filter
    if (activeFilter !== 'all') {
      filtered = filtered.filter(log => log.type === activeFilter);
    }
    
    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(query) ||
        log.timestamp.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [logs, activeFilter, searchQuery]);

  const toggleSearch = useCallback(() => {
    const newVisible = !searchVisible;
    setSearchVisible(newVisible);
    
    Animated.spring(searchBarHeight, {
      toValue: newVisible ? 50 : 0,
      useNativeDriver: false,
      tension: 65,
      friction: 9,
    }).start();
    
    if (!newVisible) {
      setSearchQuery('');
    }
  }, [searchVisible, searchBarHeight]);

  const copyLogsToClipboard = useCallback(() => {
    const logString = filteredLogs
      .slice()
      .reverse()
      .map((log) => `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`)
      .join('\n');

    Clipboard.setStringAsync(logString);
    Alert.alert(
      '✅ Logs kopiert', 
      `${filteredLogs.length} Log-Einträge wurden in die Zwischenablage kopiert.`
    );
  }, [filteredLogs]);

  const exportLogs = useCallback(() => {
    Alert.alert(
      'Export-Optionen',
      'Wähle ein Export-Format',
      [
        {
          text: 'JSON',
          onPress: () => {
            const json = JSON.stringify(filteredLogs, null, 2);
            Clipboard.setStringAsync(json);
            Alert.alert('✅ Exportiert', 'Logs als JSON in Zwischenablage kopiert');
          }
        },
        {
          text: 'TXT',
          onPress: () => copyLogsToClipboard()
        },
        {
          text: 'Abbrechen',
          style: 'cancel'
        }
      ]
    );
  }, [filteredLogs, copyLogsToClipboard]);

  const handleClearLogs = useCallback(() => {
    Alert.alert(
      'Logs löschen?',
      `Möchtest du wirklich alle ${logs.length} Log-Einträge löschen? Dies kann nicht rückgängig gemacht werden.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        { 
          text: 'Löschen', 
          style: 'destructive',
          onPress: clearLogs 
        }
      ]
    );
  }, [logs.length, clearLogs]);

  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <LogItem 
        log={item} 
        onPress={() => setExpandedLogId(expandedLogId === item.id ? null : item.id)}
        isExpanded={expandedLogId === item.id}
      />
    ),
    [expandedLogId]
  );

  const keyExtractor = useCallback((item: any) => item.id.toString(), []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      {/* Enhanced Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.titleContainer}>
            <View style={styles.terminalIconContainer}>
              <Ionicons name="terminal" size={20} color={theme.palette.primary} />
            </View>
            <View>
              <Text style={styles.title}>Terminal</Text>
              <Text style={styles.subtitle}>Console Monitor</Text>
            </View>
          </View>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={toggleSearch}
              style={[styles.headerButton, searchVisible && styles.activeButton]}
            >
              <Ionicons
                name="search"
                size={18}
                color={searchVisible ? theme.palette.primary : theme.palette.text.secondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setAutoScroll(!autoScroll)}
              style={[styles.headerButton, autoScroll && styles.activeButton]}
            >
              <Ionicons
                name={autoScroll ? "lock-closed" : "lock-open"}
                size={18}
                color={autoScroll ? theme.palette.primary : theme.palette.text.secondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={exportLogs}
              style={styles.headerButton}
              disabled={filteredLogs.length === 0}
            >
              <Ionicons
                name="download-outline"
                size={18}
                color={filteredLogs.length === 0 ? theme.palette.text.disabled : theme.palette.text.secondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleClearLogs}
              style={styles.headerButton}
              disabled={logs.length === 0}
            >
              <Ionicons
                name="trash-outline"
                size={18}
                color={logs.length === 0 ? theme.palette.text.disabled : theme.palette.error}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Bar */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Ionicons name="layers" size={12} color={theme.palette.text.secondary} />
            <Text style={styles.statText}>{logStats.total}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="close-circle" size={12} color={theme.palette.error} />
            <Text style={styles.statText}>{logStats.errors}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="warning" size={12} color={theme.palette.warning} />
            <Text style={styles.statText}>{logStats.warnings}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="information-circle" size={12} color={theme.palette.primary} />
            <Text style={styles.statText}>{logStats.info}</Text>
          </View>
          {searchQuery && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="funnel" size={12} color={theme.palette.primary} />
                <Text style={styles.statText}>{filteredLogs.length}</Text>
              </View>
            </>
          )}
        </View>

        {/* Search Bar */}
        <Animated.View style={[styles.searchContainer, { height: searchBarHeight, opacity: searchBarHeight.interpolate({ inputRange: [0, 50], outputRange: [0, 1] }) }]}>
          <Ionicons name="search" size={16} color={theme.palette.text.disabled} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Logs durchsuchen..."
            placeholderTextColor={theme.palette.text.disabled}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
              <Ionicons name="close-circle" size={18} color={theme.palette.text.disabled} />
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Filter Chips */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
          contentContainerStyle={styles.filterContent}
        >
          <FilterChip
            label="Alle"
            active={activeFilter === 'all'}
            onPress={() => setActiveFilter('all')}
            count={logs.length}
            icon="layers"
            color={theme.palette.primary}
          />
          <FilterChip
            label="Info"
            active={activeFilter === 'log'}
            onPress={() => setActiveFilter('log')}
            count={logStats.info}
            icon="information-circle"
            color={theme.palette.primary}
          />
          <FilterChip
            label="Warnungen"
            active={activeFilter === 'warn'}
            onPress={() => setActiveFilter('warn')}
            count={logStats.warnings}
            icon="warning"
            color={theme.palette.warning}
          />
          <FilterChip
            label="Fehler"
            active={activeFilter === 'error'}
            onPress={() => setActiveFilter('error')}
            count={logStats.errors}
            icon="close-circle"
            color={theme.palette.error}
          />
        </ScrollView>
      </View>

      {/* Logs List */}
      <FlatList
        ref={flatListRef}
        data={filteredLogs}
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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="terminal-outline" size={64} color={theme.palette.text.disabled} />
            </View>
            <Text style={styles.emptyText}>
              {searchQuery || activeFilter !== 'all' ? 'Keine Ergebnisse' : 'Keine Logs vorhanden'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery || activeFilter !== 'all' 
                ? 'Versuche einen anderen Filter oder Such-Begriff' 
                : 'Console-Logs werden hier in Echtzeit angezeigt'}
            </Text>
          </View>
        }
      />

      {/* Live Indicator */}
      {logs.length > 0 && (
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      )}
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
    backgroundColor: '#0d1117',
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.primary + '22',
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  terminalIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: theme.palette.primary + '15',
    borderWidth: 1,
    borderColor: theme.palette.primary + '44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.palette.text.primary,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 11,
    color: theme.palette.text.disabled,
    marginTop: 2,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: theme.palette.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  activeButton: {
    backgroundColor: theme.palette.primary + '15',
    borderColor: theme.palette.primary + '44',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0a0e14',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statDivider: {
    width: 1,
    height: 12,
    backgroundColor: theme.palette.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: theme.palette.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.palette.text.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    paddingVertical: 0,
  },
  clearSearchButton: {
    padding: 4,
  },
  filterContainer: {
    maxHeight: 44,
    marginBottom: 8,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    gap: 6,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.palette.text.disabled,
  },
  countBadge: {
    backgroundColor: theme.palette.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.palette.text.disabled,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  listContent: {
    padding: 12,
    paddingBottom: 20,
  },
  logEntry: {
    backgroundColor: '#0d1117',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  logHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logIcon: {
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  logBadge: {
    backgroundColor: theme.palette.primary + '15',
    borderColor: theme.palette.primary + '33',
  },
  warnBadge: {
    backgroundColor: theme.palette.warning + '15',
    borderColor: theme.palette.warning + '33',
  },
  errorBadge: {
    backgroundColor: theme.palette.error + '15',
    borderColor: theme.palette.error + '33',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  jsonBadge: {
    backgroundColor: '#ff9900' + '22',
    borderWidth: 1,
    borderColor: '#ff9900' + '44',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  jsonBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ff9900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timestamp: {
    color: theme.palette.text.disabled,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.8,
  },
  logText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.2,
  },
  expandHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  expandHintText: {
    fontSize: 11,
    color: theme.palette.text.disabled,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.palette.primary + '08',
    borderWidth: 2,
    borderColor: theme.palette.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '600',
    color: theme.palette.text.secondary,
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: theme.palette.text.disabled,
    textAlign: 'center',
    lineHeight: 20,
  },
  liveIndicator: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.palette.error + '22',
    borderWidth: 1,
    borderColor: theme.palette.error + '44',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.palette.error,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.palette.error,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
  },
});

export default TerminalScreen;
