import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { Alert } from "react-native";

import type { BuildStatus } from "../../../shared/types/build";
import { computeEta } from "../../../utils/buildScreenUtils";
import { isBuildActive, isFinalBuildStatus } from "./enhancedBuildScreenOrchestration";

type UseEnhancedBuildStartControllerParams = {
  hasStartBuild: boolean;
  startBuild?: (buildProfile?: string) => Promise<void>;
  buildProfile: string;
  repoValidationValid: boolean;
  buildBlockedReason: string | null;
  sanitizeUiMessage: (input: string) => string;
  status: BuildStatus;
  isMountedRef: MutableRefObject<boolean>;
};

export function useEnhancedBuildStartController(params: UseEnhancedBuildStartControllerParams) {
  const {
    hasStartBuild,
    startBuild,
    buildProfile,
    repoValidationValid,
    buildBlockedReason,
    sanitizeUiMessage,
    status,
    isMountedRef,
  } = params;

  const buildInFlightRef = useRef(false);
  const [buildInFlight, setBuildInFlight] = useState(false);
  const [buildLoading, setBuildLoading] = useState(false);
  const [buildStartTime, setBuildStartTime] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState<number>(0);

  const onStartBuild = useCallback(async () => {
    if (!repoValidationValid) {
      Alert.alert(
        "Repo fehlt",
        sanitizeUiMessage(
          "Bitte zuerst im GitHub-Repos-Screen ein Repo (owner/repo) verknuepfen.",
        ),
      );
      return;
    }
    if (buildBlockedReason) {
      Alert.alert("Nicht bereit", sanitizeUiMessage(buildBlockedReason));
      return;
    }

    if (!hasStartBuild || !startBuild) {
      Alert.alert(
        "Nicht verfügbar",
        "startBuild() ist nicht im ProjectContext definiert.",
      );
      return;
    }
    if (buildInFlightRef.current) {
      return;
    }
    buildInFlightRef.current = true;
    if (isMountedRef.current) setBuildInFlight(true);

    if (isMountedRef.current) {
      setBuildLoading(true);
      setBuildStartTime(Date.now());
    }
    try {
      await startBuild(buildProfile);
      if (isMountedRef.current) {
        Alert.alert(
          "✅ Build gestartet",
          `Der Build wurde angestoßen (${buildProfile}).`,
        );
      }
    } catch (e) {
      if (isMountedRef.current) {
        setBuildStartTime(null);
        Alert.alert(
          "❌ Fehler",
          sanitizeUiMessage(e instanceof Error ? e.message : "Build fehlgeschlagen"),
        );
      }
    } finally {
      if (isMountedRef.current) {
        setBuildLoading(false);
        setBuildInFlight(false);
      }
      buildInFlightRef.current = false;
    }
  }, [repoValidationValid, buildBlockedReason, hasStartBuild, startBuild, buildProfile, sanitizeUiMessage, isMountedRef]);

  useEffect(() => {
    const active = isBuildActive(status, buildStartTime);
    if (!active) return;

    const t = setInterval(() => {
      if (isMountedRef.current) setNowTick(Date.now());
    }, 1_000);
    return () => clearInterval(t);
  }, [buildStartTime, status, isMountedRef]);

  const elapsedMs = useMemo(() => {
    if (!buildStartTime) return 0;
    return Date.now() - buildStartTime;
  }, [buildStartTime, nowTick]);

  const etaMs = useMemo(() => {
    if (status === "idle" || status === "success" || status === "failed" || status === "error") {
      return 0;
    }
    return computeEta(status, elapsedMs);
  }, [status, elapsedMs]);

  useEffect(() => {
    if (isFinalBuildStatus(status)) {
      setBuildStartTime(null);
    }
  }, [status]);

  const canStartBuildUi = useMemo(() => {
    return (
      hasStartBuild &&
      !buildLoading &&
      !buildInFlight &&
      !buildBlockedReason
    );
  }, [hasStartBuild, buildLoading, buildInFlight, buildBlockedReason]);

  return {
    buildLoading,
    buildInFlight,
    onStartBuild,
    etaMs,
    canStartBuildUi,
  };
}
