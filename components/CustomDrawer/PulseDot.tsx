// components/CustomDrawer/PulseDot.tsx
// Animated status indicator dot — extracted from CustomDrawer.tsx.

import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import { theme } from "../../theme";

type PulseDotProps = {
  size?: number;
  color: string;
  idleColor: string;
  active: boolean;
  pulse?: boolean;
};

const PulseDot: React.FC<PulseDotProps> = ({
  size = 8,
  color,
  idleColor,
  active,
  pulse = true,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(active ? 1 : 0.6)).current;

  useEffect(() => {
    scale.stopAnimation();
    opacity.stopAnimation();

    if (!active) {
      scale.setValue(1);
      opacity.setValue(0.55);
      return;
    }

    opacity.setValue(1);

    if (!pulse) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.25,
            duration: 650,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.65,
            duration: 650,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 650,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 650,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [active, pulse, opacity, scale]);

  const baseColor = active ? color : idleColor;

  return (
    <Animated.View
      style={[
        styles.pulseDot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: baseColor,
          borderColor: active ? `${color}66` : theme.palette.border,
          transform: [{ scale }],
          opacity,
        },
        active ? (theme.glow.primarySubtle as any) : null,
      ]}
    />
  );
};

export { PulseDot };

const styles = StyleSheet.create({
  pulseDot: {
    borderWidth: 1,
  },
});
