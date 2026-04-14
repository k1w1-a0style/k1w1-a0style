import { useCallback } from "react";
import { Alert, Linking } from "react-native";

import type { BuildProfile } from "../types";
import { persistPreferredBuildProfile, refreshBuildScreenData } from "./enhancedBuildScreenActions";

export function useOpenRunAction() {
  return useCallback(async (url: string) => {
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Fehler", "URL kann nicht geöffnet werden.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert("Fehler", "Konnte URL nicht öffnen.");
    }
  }, []);
}

export function useBuildRefreshAction(params: {
  canFetch: boolean;
  hasGetWorkflowRuns: boolean;
  isMountedRef: { current: boolean };
  fetchRuns: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  refreshPreconditions: () => Promise<void>;
  setRefreshing: (v: boolean) => void;
}) {
  const { canFetch, hasGetWorkflowRuns, isMountedRef, fetchRuns, refreshHistory, refreshPreconditions, setRefreshing } = params;

  return useCallback(async () => {
    if (isMountedRef.current) setRefreshing(true);
    try {
      await refreshBuildScreenData({
        fetchRuns: canFetch && hasGetWorkflowRuns ? fetchRuns : null,
        refreshHistory,
        refreshPreconditions,
      });
    } finally {
      if (isMountedRef.current) setRefreshing(false);
    }
  }, [canFetch, hasGetWorkflowRuns, isMountedRef, fetchRuns, refreshHistory, refreshPreconditions, setRefreshing]);
}

export function useSelectBuildProfileAction(params: {
  setBuildProfile: (profile: BuildProfile) => void;
  setPreferredBuildProfile?: (profile: BuildProfile) => Promise<void>;
}) {
  const { setBuildProfile, setPreferredBuildProfile } = params;

  return useCallback(async (profile: BuildProfile) => {
    setBuildProfile(profile);
    try {
      await persistPreferredBuildProfile({
        profile,
        setPreferredBuildProfile,
      });
    } catch (error) {
      console.warn("[Build] Konnte Build-Profil nicht persistieren:", error);
    }
  }, [setBuildProfile, setPreferredBuildProfile]);
}
