import React from "react";
import {
  LayoutAnimation,
  Platform,

  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../theme";

import { styles } from "./ModeSelector.styles";

export type BuildMode = "development" | "preview" | "production";

// NOTE: In der New Architecture ist setLayoutAnimationEnabledExperimental ein No-Op (warn spam).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isNewArch = !!(global as any)?.nativeFabricUIManager;
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental && !isNewArch) {
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

