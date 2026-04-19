import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { SectionCard } from "../../../components/diagnostics/SectionCard";
import { theme } from "../../../theme";

import type { ModeDef, UiModeId } from "../types";
import { PrimaryButton, SecondaryButton } from "./ui";

export function ModeSection({
  modeHint,
  modes,
  selectedMode,
  canRun,
  busy,
  refreshStatus,
  generate,
}: {
  modeHint: string;
  modes: ModeDef[];
  selectedMode: UiModeId;
  canRun: boolean;
  busy: string | null;
  refreshStatus: (mode: UiModeId) => void | Promise<void>;
  generate: (mode: UiModeId) => void | Promise<void>;
}) {
  const modeLabel = modes.find((m) => m.id === selectedMode)?.label ?? selectedMode;

  return (
    <SectionCard title="Aktiver Modus" subtitle="Vom Build-Screen uebernommen" icon="layers-outline">
      {/* Read-only mode badge - no selection possible */}
      <View style={s.modeDisplay}>
        <View style={s.modeBadge}>
          <View style={s.modeDot} />
          <Text style={s.modeText}>{modeLabel}</Text>
        </View>
        <Text style={s.modeHint}>{modeHint}</Text>
      </View>

      <Text style={s.infoText}>
        Modus wird im Build-Screen geaendert und gilt automatisch hier.
      </Text>

      <View style={s.actions}>
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
  modeDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  modeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.palette.primary,
    backgroundColor: "rgba(0,255,0,0.04)",
  },
  modeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.palette.primary,
  },
  modeText: {
    color: theme.palette.primary,
    fontWeight: "900",
    fontSize: 15,
  },
  modeHint: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    flex: 1,
  },
  infoText: {
    color: theme.palette.text.muted,
    fontSize: 11,
    marginBottom: 14,
    fontStyle: "italic",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
