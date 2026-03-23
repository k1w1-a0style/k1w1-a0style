import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import type { ModelInfo } from "../../../contexts/AIContext";
import { AVAILABLE_MODELS } from "../../../contexts/AIContext";

import { personaTokens, styles, tierTokens, type ProviderId } from "../styles";

type Props = {
  provider: ProviderId;
  selectedMode: string;
  onSelect: (modeId: string) => void;
  highlightPersona: "speed" | "quality";
};

function renderCodingStrength(value?: number): string | null {
  if (!value || value < 1) return null;
  const clamped = Math.max(1, Math.min(5, Math.round(value)));
  return `Coding ${"★".repeat(clamped)}${"☆".repeat(5 - clamped)}`;
}

export const ModeList: React.FC<Props> = ({
  provider,
  selectedMode,
  onSelect,
  highlightPersona,
}) => {
  const modes = AVAILABLE_MODELS?.[provider] || [];
  if (modes.length === 0) {
    return (
      <Text style={styles.emptyText}>
        Für diesen Provider sind noch keine Modelle definiert.
      </Text>
    );
  }

  return (
    <View style={styles.modeList}>
      {modes.map((m: ModelInfo) => {
        const isSelected = m.id === selectedMode;
        const tier = tierTokens[m.tier];
        const persona = personaTokens[m.persona] || personaTokens.balanced;
        const isHighlighted = m.persona === highlightPersona;
        const codingStrength = renderCodingStrength(m.codingStrength);

        return (
          <TouchableOpacity
            key={m.id}
            style={[
              styles.modeTile,
              isSelected && styles.modeTileActive,
              isHighlighted && styles.modeTileHighlight,
            ]}
            onPress={() => onSelect(m.id)}
          >
            <View style={styles.modeHead}>
              <Text style={[styles.modeTitle, isSelected && styles.modeTitleActive]}>
                {m.label}
              </Text>
              <View style={[styles.tierToken, { backgroundColor: tier.bg }]}>
                <Text style={[styles.tierTokenText, { color: tier.color }]}>
                  {tier.label}
                </Text>
              </View>
            </View>

            <Text style={styles.modeDesc}>{m.description}</Text>

            <View style={styles.modeMetaRow}>
              {m.pricePerMillion ? (
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>{m.pricePerMillion}</Text>
                </View>
              ) : null}
              {m.contextWindow ? (
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>Kontext {m.contextWindow}</Text>
                </View>
              ) : null}
              {m.availabilityLabel ? (
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>Verfügbar: {m.availabilityLabel}</Text>
                </View>
              ) : null}
              {codingStrength ? (
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>{codingStrength}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.modeFoot}>
              <Text
                style={[
                  styles.personaBadge,
                  { borderColor: persona.color, color: persona.color },
                ]}
              >
                {persona.label}
              </Text>
              <Text style={styles.bestFor} numberOfLines={2}>
                {m.bestFor}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};
