import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import type { DeployStep, DeployStepStatus } from "../hooks/useOneClickDeploy";

function StepRow({ step, index }: { step: DeployStep; index: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 60,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        delay: index * 60,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  // Pulse when running
  useEffect(() => {
    if (step.status === "running") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    pulseAnim.setValue(1);
  }, [step.status, pulseAnim]);

  // Pop-in checkmark when ok
  useEffect(() => {
    if (step.status === "ok") {
      Animated.spring(checkScale, {
        toValue: 1,
        friction: 4,
        tension: 200,
        useNativeDriver: true,
      }).start();
    } else {
      checkScale.setValue(0);
    }
  }, [step.status, checkScale]);

  const iconName: keyof typeof Ionicons.glyphMap =
    step.status === "ok"
      ? "checkmark-circle"
      : step.status === "fail"
        ? "close-circle"
        : step.status === "skip"
          ? "remove-circle-outline"
          : step.status === "running"
            ? "ellipse"
            : "ellipse-outline";

  const iconColor =
    step.status === "ok"
      ? theme.palette.success
      : step.status === "fail"
        ? theme.palette.error
        : step.status === "skip"
          ? theme.palette.text.muted
          : step.status === "running"
            ? theme.palette.warning
            : theme.palette.text.disabled;

  return (
    <Animated.View
      style={[
        s.stepRow,
        step.status === "ok" && s.stepRowOk,
        step.status === "fail" && s.stepRowFail,
        step.status === "running" && s.stepRowRunning,
        {
          opacity: fadeAnim,
          transform: [{ translateX: slideAnim }],
        },
      ]}
    >
      {step.status === "running" ? (
        <Animated.View style={{ opacity: pulseAnim }}>
          <ActivityIndicator size="small" color={theme.palette.primary} />
        </Animated.View>
      ) : step.status === "ok" ? (
        <Animated.View style={{ transform: [{ scale: checkScale }] }}>
          <Ionicons name={iconName} size={20} color={iconColor} />
        </Animated.View>
      ) : (
        <Ionicons name={iconName} size={20} color={iconColor} />
      )}

      <View style={s.stepTextWrap}>
        <Text
          style={[
            s.stepLabel,
            step.status === "ok" && s.stepLabelOk,
            step.status === "fail" && s.stepLabelFail,
          ]}
        >
          {step.label}
        </Text>
        {step.detail ? (
          <Text
            style={[
              s.stepDetail,
              step.status === "fail" && { color: theme.palette.error },
              step.status === "ok" && { color: theme.palette.text.secondary },
            ]}
            numberOfLines={2}
          >
            {step.detail}
          </Text>
        ) : null}
      </View>

      {/* Connector line */}
      {index < 4 && (
        <View style={s.connectorWrap}>
          <View
            style={[
              s.connector,
              step.status === "ok" && s.connectorOk,
            ]}
          />
        </View>
      )}
    </Animated.View>
  );
}

export function OneClickDeployCard({
  steps,
  isDeploying,
  deployDone,
  disabled,
  disabledReason,
  onDeploy,
  onReset,
  onAbort,
}: {
  steps: DeployStep[];
  isDeploying: boolean;
  deployDone: boolean;
  disabled?: boolean;
  disabledReason?: string | null;
  onDeploy: () => void;
  onReset: () => void;
  onAbort: () => void;
}) {
  const allOk = steps.every((st) => st.status === "ok" || st.status === "skip");
  const hasFail = steps.some((st) => st.status === "fail");
  const deployBlocked = !!disabled && !isDeploying;

  return (
    <View style={s.card}>
      {/* Header */}
      <View style={s.header}>
        <Ionicons
          name="rocket-outline"
          size={20}
          color={deployDone ? theme.palette.success : theme.palette.primary}
        />
        <Text style={s.title}>One-Click Deploy</Text>
        {deployDone && (
          <View style={s.doneBadge}>
            <Text style={s.doneBadgeText}>FERTIG</Text>
          </View>
        )}
      </View>

      {/* Steps Timeline */}
      <View style={s.timeline}>
        {steps.map((step, idx) => (
          <StepRow key={step.id} step={step} index={idx} />
        ))}
      </View>

      {/* Action Buttons */}
      <View style={s.actions}>
        {isDeploying ? (
          <Pressable style={s.abortBtn} onPress={onAbort}>
            <Ionicons name="stop-circle-outline" size={16} color={theme.palette.error} />
            <Text style={s.abortBtnText}>Abbrechen</Text>
          </Pressable>
        ) : hasFail ? (
          <Pressable
            style={[s.retryBtn, deployBlocked && s.disabledBtn]}
            onPress={onDeploy}
            disabled={deployBlocked}
          >
            <Ionicons name="refresh-outline" size={16} color={theme.palette.warning} />
            <Text style={s.retryBtnText}>Erneut versuchen</Text>
          </Pressable>
        ) : deployDone ? (
          <Pressable style={s.resetBtn} onPress={onReset}>
            <Ionicons name="refresh-outline" size={16} color={theme.palette.text.secondary} />
            <Text style={s.resetBtnText}>Zuruecksetzen</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[s.deployBtn, deployBlocked && s.disabledBtn]}
            onPress={onDeploy}
            disabled={deployBlocked}
          >
            <Ionicons name="rocket-outline" size={18} color={theme.palette.primary} />
            <Text style={s.deployBtnText}>Deploy starten</Text>
          </Pressable>
        )}
      </View>

      {deployBlocked && !!disabledReason ? (
        <Text style={s.disabledReason} numberOfLines={3}>
          {disabledReason}
        </Text>
      ) : null}
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
    marginBottom: 16,
  },
  title: {
    flex: 1,
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 16,
  },
  doneBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.success,
    backgroundColor: "rgba(0,255,0,0.06)",
  },
  doneBadgeText: {
    color: theme.palette.success,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  timeline: { gap: 4 },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    position: "relative",
  },
  stepRowOk: {
    borderColor: "rgba(0,255,0,0.1)",
    backgroundColor: "rgba(0,255,0,0.02)",
  },
  stepRowFail: {
    borderColor: "rgba(255,68,68,0.15)",
    backgroundColor: "rgba(255,68,68,0.03)",
  },
  stepRowRunning: {
    borderColor: "rgba(0,255,0,0.15)",
    backgroundColor: "rgba(0,255,0,0.03)",
  },
  stepTextWrap: { flex: 1 },
  stepLabel: {
    color: theme.palette.text.secondary,
    fontSize: 14,
    fontWeight: "700",
  },
  stepLabelOk: { color: theme.palette.text.primary },
  stepLabelFail: { color: theme.palette.error },
  stepDetail: {
    color: theme.palette.text.muted,
    fontSize: 11,
    marginTop: 2,
  },
  connectorWrap: {
    position: "absolute",
    left: 21,
    bottom: -6,
    height: 8,
    width: 2,
    zIndex: -1,
  },
  connector: {
    flex: 1,
    width: 2,
    backgroundColor: theme.palette.border,
  },
  connectorOk: {
    backgroundColor: theme.palette.success,
  },
  actions: {
    marginTop: 16,
  },
  deployBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.palette.primary,
    backgroundColor: "transparent",
  },
  deployBtnText: {
    color: theme.palette.primary,
    fontSize: 15,
    fontWeight: "900",
  },
  abortBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.palette.error,
    backgroundColor: "transparent",
  },
  abortBtnText: {
    color: theme.palette.error,
    fontSize: 14,
    fontWeight: "800",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.palette.warning,
    backgroundColor: "transparent",
  },
  retryBtnText: {
    color: theme.palette.warning,
    fontSize: 14,
    fontWeight: "800",
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: "transparent",
  },
  resetBtnText: {
    color: theme.palette.text.secondary,
    fontSize: 14,
    fontWeight: "700",
  },
  disabledBtn: { opacity: 0.4 },
  disabledReason: {
    marginTop: 10,
    color: theme.palette.text.muted,
    fontSize: 12,
    lineHeight: 16,
  },
});
