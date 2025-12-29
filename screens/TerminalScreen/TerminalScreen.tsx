import React from "react";
import { Animated, FlatList, View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { LogEntry } from "../../contexts/TerminalContext";
import { styles } from "./styles";
import TerminalHeader from "./components/TerminalHeader";
import ConsoleOverrideStats from "./components/ConsoleOverrideStats";
import FiltersBar from "./components/FiltersBar";
import SearchBar from "./components/SearchBar";
import LogRow from "./components/LogRow";
import { useTerminalScreen } from "./hooks/useTerminalScreen";

export default function TerminalScreen() {
  const {
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
  } = useTerminalScreen();

  const renderItem = ({ item }: { item: LogEntry }) => <LogRow item={item} />;

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <TerminalHeader
        onSendLogsToAiAutoFix={sendLogsToAiAutoFix}
        onExportDebugZip={exportDebugZip}
        onShareVisibleLogsTxt={shareVisibleLogsTxt}
        onConfirmClear={confirmClear}
      />

      <ConsoleOverrideStats
        isConsoleOverrideEnabled={isConsoleOverrideEnabled}
        setConsoleOverride={setConsoleOverride}
        stats={stats}
        autoScroll={autoScroll}
      />

      <FiltersBar
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        autoScroll={autoScroll}
        setAutoScroll={setAutoScroll}
      />

      <Animated.View style={{ opacity: searchAnim }}>
        <SearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onCopyVisibleLogs={copyVisibleLogs}
        />
      </Animated.View>

      <FlatList
        style={{ flex: 1 }}
        ref={flatListRef}
        data={filteredLogs}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        onContentSizeChange={onContentSizeChange}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Keine Logs vorhanden oder Filter aktiv.
            </Text>
            <Text style={styles.emptyHint}>
              Tipp: Console Override aktivieren + irgendwas ausführen
              (Build/Chat/Import).
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
