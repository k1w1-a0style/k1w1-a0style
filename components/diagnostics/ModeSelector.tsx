import React from "react";
import {
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../theme";

export type BuildMode = "development" | "preview" | "production";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LABEL: Record<BuildMode, string> = {
  development: "Dev",
  preview: "Preview",
  production: "Production",
};

export function ModeSelector({
  isAdvanced,
  onToggleAdvanced,
  recommendedMode,
  selectedModes,
  onChangeSelected,
  allowAll,
  allSelected,
  onToggleAll,
  disabled,
}: {
  isAdvanced: boolean;
  onToggleAdvanced: () => void;
  recommendedMode: BuildMode;
  selectedModes: BuildMode[];
  onChangeSelected: (next: BuildMode[]) => void;
  allowAll: boolean;
  allSelected: boolean;
  onToggleAll: () => void;
  disabled?: boolean;
}): React.ReactElement {
  const toggleMode = (m: BuildMode) => {
    const set = new Set(selectedModes);
    if (set.has(m)) set.delete(m);
    else set.add(m);
    const next = Array.from(set);
    // Keep at least one, to avoid empty selection edge-cases.
    onChangeSelected(next.length ? next : [recommendedMode]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Mode</Text>
          <Text style={styles.value} numberOfLines={1}>
            {isAdvanced
              ? allSelected
                ? "All modes"
                : selectedModes.map((m) => LABEL[m]).join(" · ")
              : `Recommended: ${LABEL[recommendedMode]}`}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.advBtn, disabled && styles.disabled]}
          onPress={() => {
            if (disabled) return;
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            onToggleAdvanced();
          }}
          accessibilityRole="button"
        >
          <Ionicons name={isAdvanced ? "options" : "options-outline"} size={16} color={theme.palette.text.primary} />
          <Text style={styles.advBtnText}>{isAdvanced ? "Advanced" : "Choose"}</Text>
        </TouchableOpacity>
      </View>

      {isAdvanced ? (
        <View style={styles.advanced}>
          <View style={styles.chipsRow}>
            {(Object.keys(LABEL) as BuildMode[]).map((m) => {
              const on = !allSelected && selectedModes.includes(m);
              return (
                <TouchableOpacity
                  key={m}
                  style={[styles.chip, on && styles.chipOn, disabled && styles.disabled]}
                  onPress={() => {
                    if (disabled) return;
                    if (allSelected) return; // prevent confusing mixed state
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    toggleMode(m);
                  }}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{LABEL[m]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {allowAll ? (
            <TouchableOpacity
              style={[styles.allRow, disabled && styles.disabled]}
              onPress={() => {
                if (disabled) return;
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                onToggleAll();
              }}
            >
              <Ionicons
                name={allSelected ? "checkbox" : "square-outline"}
                size={18}
                color={allSelected ? theme.palette.primaryLight : theme.palette.text.muted}
              />
              <Text style={styles.allText}>All modes</Text>
              <Text style={styles.allHint}>(slower)</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.palette.card,
    borderColor: theme.palette.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  label: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  value: {
    marginTop: 4,
    color: theme.palette.text.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  advBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.backgroundDark,
  },
  advBtnText: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 13,
  },
  advanced: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.backgroundDark,
  },
  chipOn: {
    backgroundColor: "rgba(0,255,0,0.10)",
    borderColor: "rgba(0,255,0,0.25)",
  },
  chipText: {
    color: theme.palette.text.secondary,
    fontWeight: "900",
  },
  chipTextOn: {
    color: theme.palette.text.primary,
  },
  allRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  allText: {
    color: theme.palette.text.primary,
    fontWeight: "800",
  },
  allHint: {
    color: theme.palette.text.muted,
    fontSize: 12,
    marginLeft: 4,
  },
  disabled: {
    opacity: 0.55,
  },
});
