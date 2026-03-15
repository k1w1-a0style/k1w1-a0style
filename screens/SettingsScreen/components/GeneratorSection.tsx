import React from "react";
import { Text, View } from "react-native";

import type { ProviderId } from "../styles";
import { styles } from "../styles";

import type { ProviderStatusView } from "../hooks/settingsHelpers";
import { ModeList } from "./ModeList";
import { ProviderTiles } from "./ProviderTiles";

type Props = {
  generatorProvider: ProviderId;
  selectedChatMode: string;
  highlightPersona: "speed" | "quality";
  apiKeys: Record<string, string[]>;
  onSelectProvider: (p: ProviderId) => void;
  onSelectMode: (modeId: string) => void;
  getProviderStatus: (provider: ProviderId) => ProviderStatusView;
};

export function GeneratorSection({
  generatorProvider,
  selectedChatMode,
  highlightPersona,
  apiKeys,
  onSelectProvider,
  onSelectMode,
  getProviderStatus,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.h2}>Generator (Chat)</Text>
      <ProviderTiles
        selectedProvider={generatorProvider}
        apiKeys={apiKeys}
        onSelect={onSelectProvider}
        getProviderStatus={getProviderStatus}
      />

      <Text style={styles.h3}>Model</Text>
      <ModeList
        provider={generatorProvider}
        selectedMode={selectedChatMode}
        onSelect={onSelectMode}
        highlightPersona={highlightPersona}
      />
    </View>
  );
}
