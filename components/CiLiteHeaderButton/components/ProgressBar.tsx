// components/CiLiteHeaderButton/components/ProgressBar.tsx
// Animated progress bar with shimmer effect.

import React from "react";
import { Animated, Text, View } from "react-native";
import { styles } from "../styles";

interface ProgressBarProps {
  progressAnim: Animated.Value;
  shimmerAnim: Animated.Value;
  progressPctClamped: number;
  label: string;
  busy: boolean;
}

export function ProgressBar({ progressAnim, shimmerAnim, progressPctClamped, label, busy }: ProgressBarProps) {
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressMetaRow}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressPct}>{Math.round(progressPctClamped)}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ["0%", "100%"],
                extrapolate: "clamp",
              }),
            },
          ]}
        />
        {busy ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.progressShimmer,
              {
                transform: [{
                  translateX: shimmerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-60, 260],
                  }),
                }],
              },
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}
