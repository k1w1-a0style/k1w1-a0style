import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import type { QualityMode } from "../../../contexts/AIContext";

import { personaTokens, styles } from "../styles";

type Props = {
  qualityMode: QualityMode;
  limitInfo: string;
  onSetQuality: (mode: QualityMode) => void;
};

export const QualitySection: React.FC<Props> = ({
  qualityMode,
  limitInfo,
  onSetQuality,
}) => {
  return (
    <View style={styles.card}>
      <Text style={styles.h2}>Quality Mode</Text>

      <View style={styles.qualityRow}>
        {(["speed", "balanced", "quality", "review"] as QualityMode[]).map(
          (m) => {
            const isActive = qualityMode === m;
            const tok = personaTokens[m] || personaTokens.balanced;

            return (
              <TouchableOpacity
                testID={`settings-quality-${m}-button`}
                key={m}
                onPress={() => onSetQuality(m)}
                activeOpacity={0.85}
                style={[styles.qualityBtn, isActive && styles.qualityBtnActive]}
              >
                <Text
                  style={[
                    styles.qualityBtnText,
                    { color: tok.color },
                    isActive && styles.qualityBtnTextActive,
                  ]}
                >
                  {tok.label}
                </Text>
              </TouchableOpacity>
            );
          },
        )}
      </View>

      <Text style={styles.note}>{limitInfo}</Text>
    </View>
  );
};
