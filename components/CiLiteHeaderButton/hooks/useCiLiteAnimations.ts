// components/CiLiteHeaderButton/hooks/useCiLiteAnimations.ts
// Handles: progress bar animation, shimmer effect, header pulse ring.

import { useEffect, useMemo, useRef } from "react";
import { Animated } from "react-native";
import type { StepState } from "../types";

interface AnimationInput {
  headerState: StepState;
  visible: boolean;
  dispatching: boolean;
  logsLoading: boolean;
  workflowStatus: string | undefined;
  stepInfo: { lint: StepState; typecheck: StepState };
  done: boolean;
  ok: boolean;
  busy: boolean;
}

export function useCiLiteAnimations(input: AnimationInput) {
  const { headerState, visible, dispatching, logsLoading, workflowStatus, stepInfo, done, ok, busy } = input;

  // ---- Header pulse ring ----
  const ringAnim = useRef(new Animated.Value(0)).current;
  const ringLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (headerState === "running") {
      ringLoopRef.current?.stop();
      ringAnim.setValue(0);
      ringLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(ringAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(ringAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
      );
      ringLoopRef.current.start();
    } else {
      ringLoopRef.current?.stop();
      ringLoopRef.current = null;
      ringAnim.setValue(0);
    }
    return () => { ringLoopRef.current?.stop(); };
  }, [headerState, ringAnim]);

  // ---- Progress bar ----
  const progressAnim = useRef(new Animated.Value(0)).current;

  const progressTarget = useMemo(() => {
    if (dispatching) return { pct: 10, label: "Dispatch…" };
    if (!input.done && !input.busy && !dispatching) return { pct: 0, label: "" };
    if (stepInfo.lint === "running") return { pct: 35, label: "ESLint läuft…" };
    if (stepInfo.lint === "success" && stepInfo.typecheck === "waiting") return { pct: 55, label: "Starte Typecheck…" };
    if (stepInfo.typecheck === "running") return { pct: 78, label: "Typecheck läuft…" };
    if (done) return { pct: 100, label: ok ? "Fertig" : "Fertig (Fehler)" };
    return { pct: 25, label: "Initialisiere…" };
  }, [dispatching, stepInfo.lint, stepInfo.typecheck, done, ok, input.done, input.busy]);

  const progressPctClamped = Math.max(0, Math.min(100, progressTarget.pct));

  useEffect(() => {
    Animated.timing(progressAnim, { toValue: progressPctClamped, duration: 420, useNativeDriver: false }).start();
  }, [progressPctClamped, progressAnim]);

  // ---- Shimmer ----
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const shimmerLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    shimmerLoopRef.current?.stop();
    shimmerLoopRef.current = null;
    shimmerAnim.setValue(0);

    if (!visible) return;
    if (!(dispatching || logsLoading || workflowStatus === "in_progress")) return;

    shimmerLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ]),
    );
    shimmerLoopRef.current.start();

    return () => { shimmerLoopRef.current?.stop(); shimmerLoopRef.current = null; };
  }, [visible, dispatching, logsLoading, workflowStatus, shimmerAnim]);

  // ---- Status text ----
  const statusText = useMemo(() => {
    if (busy) {
      return stepInfo.typecheck === "waiting" || stepInfo.typecheck === "idle"
        ? "Lint-Check läuft" : "TypeScript-Check läuft";
    }
    if (done && ok) return "Alles grün";
    if (done && !ok) return "Fehler gefunden";
    return "Bereit";
  }, [busy, stepInfo.typecheck, done, ok]);

  const statusLamp: StepState = useMemo(() => {
    if (busy) return "running";
    if (done && ok) return "success";
    if (done && !ok) return "failure";
    return "waiting";
  }, [busy, done, ok]);

  return {
    ringAnim,
    progressAnim,
    progressTarget,
    progressPctClamped,
    shimmerAnim,
    statusText,
    statusLamp,
  };
}
