import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { SectionCard } from "../../../components/diagnostics/SectionCard";
import { theme } from "../../../theme";

import type { ModeDef, UiModeId } from "../types";
import { PrimaryButton, SecondaryButton } from "./ui";
import { styles } from "../styles";

export function ModeSection({
  modeHint,
  modes,
  selectedMode,
  setSelectedMode,
  canRun,
  busy,
  refreshStatus,
  generate,
}: {
  modeHint: string;
  modes: ModeDef[];
  selectedMode: UiModeId;
  setSelectedMode: (v: UiModeId) => void;
  canRun: boolean;
  busy: string | null;
  refreshStatus: (mode: UiModeId) => void | Promise<void>;
  generate: (mode: UiModeId) => void | Promise<void>;
}) {
  // Mode wird automatisch vom Build-Screen uebernommen
  const modeLabel = modes.find((m) => m.id === selectedMode)?.label ?? selectedMode;

  return (
    <SectionCard title="Aktiver Modus" subtitle="Automatisch vom Build-Screen" icon="layers-outline">
      <View style={s.modeBadgeRow}>
        <View style={s.modeBadge}>
          <Ionicons name="radio-button-on" size={14} color={theme.palette.primary} />
          <Text style={s.modeBadgeText}>{modeLabel}</Text>
        </View>
        <Text style={s.modeHint}>{modeHint}</Text>
      </View>

      <View style={styles.modeActions}>
        <SecondaryButton
          title="Status pruefen"
          onPress={() => refreshStatus(selectedMode)}
          disabled={!canRun || Boolean(busy)}
          leftIcon="pulse-outline"
        />
        <PrimaryButton
          title="Generieren"
          onPress={() => generate(selectedMode)}
          disabled={!canRun || Boolean(busy)}
          leftIcon="sparkles-outline"
        />
      </View>
    </SectionCard>
  );
}

const s = StyleSheet.create({
  modeBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  modeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: theme.palette.primary,
    backgroundColor: "rgba(0,255,0,0.06)",
  },
  modeBadgeText: {
    color: theme.palette.primary,
    fontWeight: "900",
    fontSize: 14,
  },
  modeHint: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    flex: 1,
  },
});
