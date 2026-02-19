import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import type { BuildStatus } from "../../../shared/types/build";

type Props = {
  status: BuildStatus;
  statusLabel: string;
  message: string;
  jobId: string | number | null;
  etaMs: number;
  formatDuration: (ms: number) => string;
  progress?: number;
};

const STEPS: { key: BuildStatus; label: string }[] = [
  { key: "queued", label: "In Warteschlange" },
  { key: "building", label: "Build laeuft" },
  { key: "success", label: "Abgeschlossen" },
];

function getProgressPercent(status: BuildStatus, progress?: number): number {
  if (status === "idle") return 0;
  if (status === "queued") return 15;
  if (status === "building") return typeof progress === "number" ? Math.max(25, Math.round(progress * 100)) : 50;
  if (status === "success") return 100;
  if (status === "failed" || status === "error") return 100;
  return 0;
}

export function BuildProgressSection({
  status,
  statusLabel,
  message,
  jobId,
  etaMs,
  formatDuration,
  progress,
}: Props) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const pct = getProgressPercent(status, progress);
  const isActive = status === "queued" || status === "building";
  const isFailed = status === "failed" || status === "error";

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 800,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [pct, widthAnim]);

  useEffect(() => {
    if (isActive) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: false,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    glowAnim.setValue(0);
  }, [isActive, glowAnim]);

  const barColor = isFailed ? theme.palette.error : theme.palette.primary;

  const interpolatedWidth = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Ionicons
          name={isFailed ? "alert-circle" : isActive ? "hourglass-outline" : status === "success" ? "checkmark-circle" : "radio-button-off"}
          size={20}
          color={isFailed ? theme.palette.error : status === "success" ? theme.palette.success : theme.palette.primary}
        />
        <Text style={s.title}>Build-Fortschritt</Text>
        <Text style={[s.pctText, isFailed && { color: theme.palette.error }]}>
          {pct}%
        </Text>
      </View>

      {/* Progress Bar */}
      <View style={s.barOuter}>
        <Animated.View
          style={[
            s.barInner,
            {
              width: interpolatedWidth,
              backgroundColor: barColor,
            },
          ]}
        />
        {isActive && (
          <Animated.View
            style={[
              s.barGlow,
              {
                width: interpolatedWidth,
                opacity: glowOpacity,
                backgroundColor: barColor,
              },
            ]}
          />
        )}
      </View>

      {/* Status Label */}
      <Text style={s.statusLabel}>{statusLabel}</Text>
      {!!message && <Text style={s.message}>{message}</Text>}
      {!!jobId && <Text style={s.message}>Job #{jobId}</Text>}
      {etaMs > 0 && (
        <Text style={s.eta}>
          Restzeit: ~{formatDuration(etaMs)}
        </Text>
      )}

      {/* Step Indicators */}
      <View style={s.steps}>
        {STEPS.map((step, idx) => {
          const stepIdx = STEPS.findIndex((st) => st.key === status);
          const isDone = idx < stepIdx || status === "success";
          const isCurrent = step.key === status;
          return (
            <View key={step.key} style={s.step}>
              <View
                style={[
                  s.stepDot,
                  isDone && s.stepDotDone,
                  isCurrent && s.stepDotCurrent,
                  isFailed && isCurrent && s.stepDotFail,
                ]}
              >
                {isDone && (
                  <Ionicons name="checkmark" size={10} color={theme.palette.background} />
                )}
              </View>
              <Text
                style={[
                  s.stepLabel,
                  isDone && s.stepLabelDone,
                  isCurrent && s.stepLabelCurrent,
                ]}
              >
                {step.label}
              </Text>
              {idx < STEPS.length - 1 && (
                <View style={[s.stepLine, isDone && s.stepLineDone]} />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginTop: 14,
    marginHorizontal: 16,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  title: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 15,
    flex: 1,
  },
  pctText: {
    color: theme.palette.primary,
    fontWeight: "900",
    fontSize: 18,
    fontFamily: "monospace",
  },
  barOuter: {
    height: 10,
    backgroundColor: theme.palette.backgroundDark,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.palette.border,
    position: "relative",
  },
  barInner: {
    height: "100%",
    borderRadius: 999,
  },
  barGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    borderRadius: 999,
  },
  statusLabel: {
    color: theme.palette.text.primary,
    fontWeight: "800",
    fontSize: 14,
    marginTop: 12,
  },
  message: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginTop: 4,
  },
  eta: {
    color: theme.palette.warning,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  steps: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 4,
  },
  step: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.backgroundDark,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotDone: {
    borderColor: theme.palette.success,
    backgroundColor: theme.palette.success,
  },
  stepDotCurrent: {
    borderColor: theme.palette.primary,
    backgroundColor: "rgba(0,255,0,0.15)",
  },
  stepDotFail: {
    borderColor: theme.palette.error,
    backgroundColor: "rgba(255,68,68,0.15)",
  },
  stepLabel: {
    color: theme.palette.text.muted,
    fontSize: 10,
    fontWeight: "700",
    marginLeft: 4,
  },
  stepLabelDone: { color: theme.palette.success },
  stepLabelCurrent: { color: theme.palette.primary },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: theme.palette.border,
    marginHorizontal: 4,
  },
  stepLineDone: {
    backgroundColor: theme.palette.success,
  },
});
