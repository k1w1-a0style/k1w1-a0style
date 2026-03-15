import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,

  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import type { DeployStep } from "../hooks/useOneClickDeploy";
import { resolvePrimaryActionLabel } from "../hooks/statusCommunication";

import { s } from "./OneClickDeployCard.styles";

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
  autoSyncSecrets,
  onToggleAutoSyncSecrets,
  onDeploy,
  onReset,
  onAbort,
}: {
  steps: DeployStep[];
  isDeploying: boolean;
  deployDone: boolean;
  disabled?: boolean;
  disabledReason?: string | null;
  autoSyncSecrets: boolean;
  onToggleAutoSyncSecrets: () => void;
  onDeploy: () => void;
  onReset: () => void;
  onAbort: () => void;
}) {
  const hasFail = steps.some((st) => st.status === "fail");
  const deployBlocked = !!disabled && !isDeploying;
  const primaryActionLabel = resolvePrimaryActionLabel({
    isDeploying,
    hasFail,
    deployDone,
    deployBlocked,
  });

  return (
    <View style={s.card}>
      {/* Header */}
      <View style={s.header}>
        <Ionicons
          name="rocket-outline"
          size={20}
          color={deployDone ? theme.palette.success : theme.palette.primary}
        />
        <Text style={s.title}>Build-Autoflow</Text>
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


      <Pressable style={s.optionRow} onPress={onToggleAutoSyncSecrets} disabled={isDeploying}>
        <View style={s.optionTextWrap}>
          <Text style={s.optionLabel}>Secrets vor Build auto-syncen</Text>
          <Text style={s.optionHint}>Optional (standardmäßig aus). Bei Bedarf manuell in Repo/Connections setzen</Text>
        </View>
        <View style={[s.optionLamp, autoSyncSecrets ? s.optionLampOn : s.optionLampOff]}>
          <Text style={s.optionLampText}>{autoSyncSecrets ? "AN" : "AUS"}</Text>
        </View>
      </Pressable>

      {/* Action Buttons */}
      <View style={s.actions}>
        <Text style={s.optionHint}>Hauptaktion: {primaryActionLabel}</Text>
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
            <Text style={s.retryBtnText}>Vorbereitung erneut ausführen</Text>
          </Pressable>
        ) : deployDone ? (
          <Pressable style={s.resetBtn} onPress={onReset}>
            <Ionicons name="refresh-outline" size={16} color={theme.palette.text.secondary} />
            <Text style={s.resetBtnText}>Ablauf zurücksetzen</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[s.deployBtn, deployBlocked && s.disabledBtn]}
            onPress={onDeploy}
            disabled={deployBlocked}
          >
            <Ionicons name="rocket-outline" size={18} color={theme.palette.primary} />
            <Text style={s.deployBtnText}>Build mit Vorbereitung starten</Text>
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
