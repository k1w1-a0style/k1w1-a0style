import React from "react";
import { View } from "react-native";

export function ProgressBar({ pct, styles }: { pct: number; styles: any }) {
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <View style={styles.progressOuter}>
      <View
        style={[
          styles.progressInner,
          { width: `${Math.round(clamped * 100)}%` },
        ]}
      />
    </View>
  );
}
