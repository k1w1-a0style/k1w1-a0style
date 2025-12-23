import React from "react";
import { View, Text, TouchableOpacity, Switch } from "react-native";
import { styles } from "../styles";
import type { Filter } from "../types";

type Props = {
  activeFilter: Filter;
  setActiveFilter: (f: Filter) => void;
  autoScroll: boolean;
  setAutoScroll: (v: boolean) => void;
};

export default function FiltersBar({
  activeFilter,
  setActiveFilter,
  autoScroll,
  setAutoScroll,
}: Props) {
  return (
    <View style={styles.filters}>
      {(["all", "log", "warn", "error"] as Filter[]).map((t) => {
        const active = activeFilter === t;
        return (
          <TouchableOpacity
            key={t}
            onPress={() => setActiveFilter(t)}
            style={[styles.filterBtn, active && styles.filterBtnActive]}
          >
            <Text
              style={[styles.filterText, active && styles.filterTextActive]}
            >
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
  );
}
