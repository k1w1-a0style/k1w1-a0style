import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import type { ProviderId } from "../styles";
import { styles } from "../styles";

import { ModeList } from "./ModeList";
import { ProviderTiles } from "./ProviderTiles";

type Props = {
  agentProvider: ProviderId;
  selectedAgentMode: string;
  onSelectMode: (modeId: string) => void;
  onSelectProvider: (p: ProviderId) => void;
  agentEnabled: boolean;
  setAgentEnabled: (v: boolean) => void;
  apiKeys: Record<string, string[]>;
  getProviderStatus: (p: ProviderId) => {
    limitReached: boolean;
    status: string;
    message?: string;
    lastRotation?: unknown;
  };
};

export const AgentSection: React.FC<Props> = ({
  agentProvider,
  selectedAgentMode,
  onSelectMode,
  onSelectProvider,
  agentEnabled,
  setAgentEnabled,
  apiKeys,
  getProviderStatus,
}) => {
  const agentHighlightPersona: "speed" | "quality" = "quality";

  return (
    <View style={styles.card}>
      <Text style={styles.h2}>Agent</Text>

      <View style={styles.agentToggleRow}>
        <Text style={styles.agentToggleLabel}>Zusätzlicher Agent</Text>
        <View style={styles.agentTogglePills}>
          <TouchableOpacity
            style={[
              styles.agentTogglePill,
              agentEnabled && styles.agentTogglePillActive,
            ]}
            onPress={() => setAgentEnabled(true)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.agentTogglePillText,
                agentEnabled && styles.agentTogglePillTextActive,
              ]}
            >
              An
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.agentTogglePill,
              !agentEnabled && styles.agentTogglePillActiveOff,
            ]}
            onPress={() => setAgentEnabled(false)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.agentTogglePillText,
                !agentEnabled && styles.agentTogglePillTextActiveOff,
              ]}
            >
              Aus
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.agentToggleHint}>
        Wenn „Aus“, wird nur der Generator genutzt (kein zweiter Review-Pass).
      </Text>

      <ProviderTiles
        selectedProvider={agentProvider}
        onSelect={onSelectProvider}
        apiKeys={apiKeys}
        getProviderStatus={getProviderStatus}
      />

      <Text style={styles.h3}>Model</Text>
      <ModeList
        provider={agentProvider}
        selectedMode={selectedAgentMode}
        onSelect={onSelectMode}
        highlightPersona={agentHighlightPersona}
      />
    </View>
  );
};
