import React from "react";
import { View, Text, Switch } from "react-native";
import { styles } from "../styles";

type Props = {
  isConsoleOverrideEnabled: boolean;
  setConsoleOverride: (enabled: boolean) => void;
  stats: { total: number; warnings: number; errors: number; info: number };
  autoScroll: boolean;
};

export default function ConsoleOverrideStats({
  isConsoleOverrideEnabled,
  setConsoleOverride,
  stats,
  autoScroll,
}: Props) {
  return (
    <View style={styles.topBox}>
      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleTitle}>Console Override</Text>
          <Text style={styles.toggleHint}>
            console.log/warn/error → Terminal
          </Text>
        </View>
        <Switch
          value={isConsoleOverrideEnabled}
          onValueChange={setConsoleOverride}
        />
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
          <Text style={styles.statValue}>{autoScroll ? "ON" : "OFF"}</Text>
        </View>
      </View>
    </View>
  );
}
