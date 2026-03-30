// components/CiLiteHeaderButton/components/StatusIndicators.tsx
// Small visual indicators: StatusLamp (colored dot with pulse) + AnimatedDots.

import React, { useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import { theme } from "../../../theme";
import { styles } from "../styles";
import type { StepState } from "../types";

export function StatusLamp({ state, size = 10 }: { state: StepState; size?: number }) {
  const pulse = useRef(new Animated.Value(0)).current;

  const color =
    state === "success" ? theme.palette.success
    : state === "failure" ? theme.palette.error
    : state === "running" ? theme.palette.primary
    : theme.palette.borderLight;

  useEffect(() => {
    pulse.stopAnimation();
    pulse.setValue(0);
    if (state !== "running") return;

    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 550, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [state, pulse]);

  const scale = state === "running"
    ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) : 1;
  const opacity = state === "running"
    ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) : 1;
  const glowStyle =
    state === "success" || state === "running" ? theme.glow.primarySubtle
    : state === "failure" ? theme.glow.error
    : undefined;

  return (
    <Animated.View
      style={[
        {
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: color, transform: [{ scale }], opacity,
        },
        glowStyle ?? null,
      ]}
    />
  );
}

export function StepPill({ label, state }: { label: string; state: StepState }) {
  return (
    <View style={styles.stepPill}>
      <StatusLamp state={state} size={10} />
      <Text style={styles.stepText}>{label}</Text>
    </View>
  );
}

export function AnimatedDots({ active }: { active: boolean }) {
  const [dots, setDots] = useState<string>("");

  useEffect(() => {
    if (!active) { setDots(""); return; }
    let n = 0;
    const t = setInterval(() => { n = (n + 1) % 4; setDots(".".repeat(n)); }, 350);
    return () => clearInterval(t);
  }, [active]);

  return <Text style={styles.dots}>{dots}</Text>;
}
