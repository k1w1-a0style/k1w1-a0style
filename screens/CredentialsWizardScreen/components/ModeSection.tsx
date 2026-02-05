import React from "react";
import { View } from "react-native";

import { SectionCard } from "../../../components/diagnostics/SectionCard";

import type { ModeDef, UiModeId } from "../types";
import { ModeSegmented, PrimaryButton, SecondaryButton } from "./ui";
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
  return (
    <SectionCard title="Mode" subtitle={modeHint} icon="layers-outline">
      <ModeSegmented value={selectedMode} onChange={setSelectedMode} modes={modes} />

      <View style={styles.modeActions}>
        <SecondaryButton
          title="Check status"
          onPress={() => refreshStatus(selectedMode)}
          disabled={!canRun || Boolean(busy)}
          leftIcon="pulse-outline"
        />
        <PrimaryButton
          title="Generate"
          onPress={() => generate(selectedMode)}
          disabled={!canRun || Boolean(busy)}
          leftIcon="sparkles-outline"
        />
      </View>
    </SectionCard>
  );
}
