import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { BuildStatus } from "../../../shared/types/build";
import { theme } from "../../../theme";
import type { DeployStep, DeployStepStatus } from "../hooks/useOneClickDeploy";

import { s } from "./BuildProgressSection.styles";

type Props = {
  status: BuildStatus;
  statusLabel: string;
  message: string;
  jobId: string | number | null;
  etaMs: number;
  formatDuration: (ms: number) => string;
  progress?: number;
  isDeploying?: boolean;
  deploySteps?: DeployStep[];
  buildBlockedReason?: string | null;
};

type UiPhaseState = "done" | "current" | "upcoming" | "failed";

type UiPhase = {
  id: string;
  label: string;
  state: UiPhaseState;
  detail?: string;
};

const FALLBACK_PHASES = [
  { id: "prepare", label: "Vorbereitung" },
  { id: "handoff", label: "Workflow gestartet" },
  { id: "build", label: "EAS Build läuft" },
  { id: "result", label: "Ergebnis fertig" },
] as const;

function getProgressPercent(status: BuildStatus, progress?: number): number {
  if (status === "idle") return 0;
  if (status === "queued") return 15;
  if (status === "building") {
    return typeof progress === "number"
      ? Math.max(25, Math.round(progress * 100))
      : 55;
  }
  if (status === "success") return 100;
  if (status === "failed" || status === "error") return 100;
  return 0;
}

function mapDeployStepToPhase(step: DeployStep): UiPhase {
  const phaseMap: Record<DeployStepStatus, UiPhaseState> = {
    ok: "done",
    running: "current",
    pending: "upcoming",
    skip: "done",
    fail: "failed",
  };

  return {
    id: step.id,
    label: step.label,
    state: phaseMap[step.status],
    detail: step.detail,
  };
}

function getFallbackPhases(status: BuildStatus, statusLabel: string, message: string, buildBlockedReason?: string | null): UiPhase[] {
  const failed = status === "failed" || status === "error";
  return FALLBACK_PHASES.map((phase, idx) => {
    let state: UiPhaseState = "upcoming";
    if (failed) {
      if (idx < 2) state = "done";
      if (idx === 2) state = "failed";
      if (idx === 3) state = "failed";
    } else if (status === "success") {
      state = "done";
    } else if (status === "building") {
      if (idx < 2) state = "done";
      else if (idx === 2) state = "current";
    } else if (status === "queued") {
      if (idx === 0) state = "done";
      else if (idx === 1) state = "current";
    } else if (status === "idle") {
      if (idx === 0) state = buildBlockedReason ? "failed" : "current";
    }

    const detail =
      idx === 2 && (status === "building" || failed) ? (message || statusLabel) :
      idx === 1 && status === "queued" ? (message || statusLabel) :
      idx === 0 && status === "idle" ? buildBlockedReason || "Bereit zum Start" :
      undefined;

    return {
      id: phase.id,
      label: phase.label,
      state,
      detail,
    };
  });
}

export function BuildProgressSection({
  status,
  statusLabel,
  message,
  jobId,
  etaMs,
  formatDuration,
  progress,
  isDeploying = false,
  deploySteps,
  buildBlockedReason,
}: Props) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const isFailed = status === "failed" || status === "error";
  const isBuildActive = status === "queued" || status === "building";
  const isActive = isDeploying || isBuildActive;
  const phaseHeading = isBuildActive
    ? "Aktive Build-Phase"
    : isDeploying
      ? "Aktive Vorbereitungsphase"
      : "Phasenübersicht";

  const phases = useMemo(() => {
    if (isDeploying && deploySteps && deploySteps.length > 0) {
      return deploySteps.map(mapDeployStepToPhase);
    }
    return getFallbackPhases(status, statusLabel, message, buildBlockedReason);
  }, [isDeploying, deploySteps, status, statusLabel, message, buildBlockedReason]);

  const doneCount = phases.filter((phase) => phase.state === "done").length;
  const currentCount = phases.filter((phase) => phase.state === "current").length;
  const basePct = Math.round((doneCount / Math.max(phases.length, 1)) * 100);

  const pct = isBuildActive
    ? getProgressPercent(status, progress)
    : isDeploying
      ? Math.max(basePct, currentCount > 0 ? Math.min(basePct + 8, 95) : basePct)
      : getProgressPercent(status, progress);

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
        <Text style={s.title}>Arbeitsphasen</Text>
        <Text style={[s.pctText, isFailed && { color: theme.palette.error }]}>{pct}%</Text>
      </View>

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

      <Text style={s.statusLabel}>{statusLabel}</Text>
      <Text style={s.message}>{phaseHeading}</Text>
      {!!message && <Text style={s.message}>{message}</Text>}
      {!!jobId && <Text style={s.message}>Job #{jobId}</Text>}
      {etaMs > 0 && isBuildActive ? <Text style={s.eta}>Restzeit: ~{formatDuration(etaMs)}</Text> : null}

      <View style={s.phaseList}>
        {phases.map((phase) => {
          const isDone = phase.state === "done";
          const isCurrent = phase.state === "current";
          const isPhaseFailed = phase.state === "failed";
          return (
            <View
              key={phase.id}
              style={[
                s.phaseRow,
                isDone && s.phaseRowDone,
                isCurrent && s.phaseRowCurrent,
                isPhaseFailed && s.phaseRowFailed,
              ]}
            >
              <View
                style={[
                  s.phaseDot,
                  isDone && s.phaseDotDone,
                  isCurrent && s.phaseDotCurrent,
                  isPhaseFailed && s.phaseDotFail,
                ]}
              >
                {isDone ? (
                  <Ionicons name="checkmark" size={11} color={theme.palette.background} />
                ) : isCurrent ? (
                  <Ionicons name="ellipse" size={8} color={theme.palette.primary} />
                ) : isPhaseFailed ? (
                  <Ionicons name="close" size={11} color={theme.palette.error} />
                ) : null}
              </View>
              <View style={s.phaseTextWrap}>
                <Text
                  style={[
                    s.phaseLabel,
                    isDone && s.phaseLabelDone,
                    isCurrent && s.phaseLabelCurrent,
                    isPhaseFailed && s.phaseLabelFail,
                  ]}
                >
                  {phase.label}
                </Text>
                {isCurrent ? <Text style={s.phaseDetail}>Jetzt aktiv</Text> : null}
                {!!phase.detail && <Text style={s.phaseDetail}>{phase.detail}</Text>}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
