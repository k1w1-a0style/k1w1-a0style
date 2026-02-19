import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { BuildProfile } from "../types";
import { getExpoToken, getGitHubToken } from "../../../infra/github/githubService";
import { STORAGE_KEYS, credKeyForProfile } from "../../../lib/storageKeys";

/**
 * Centralized precondition checks for Build Screen.
 * NOTE: Behavior intentionally matches the previous inline implementation.
 */
export function useBuildPreconditions(buildProfile: BuildProfile) {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [hasTokens, setHasTokens] = useState(false);
  const [hasSigningKey, setHasSigningKey] = useState(false);
  const [hasDiagOk, setHasDiagOk] = useState(false);

  const refreshPreconditions = useCallback(async () => {
    try {
      // Tokens
      const [gh, expo] = await Promise.all([
        getGitHubToken().catch(() => ""),
        getExpoToken().catch(() => ""),
      ]);
      if (isMountedRef.current) setHasTokens(!!(gh && expo));

      // Signing key (profile-aware)
      const keyMode = buildProfile === "development" ? "dev" : buildProfile;
      const credKey = credKeyForProfile(
        keyMode === "dev" ? "development" : (keyMode as "preview" | "production"),
      );
      const val = await AsyncStorage.getItem(credKey).catch(() => null);
      if (isMountedRef.current) setHasSigningKey(val === "true");

      // Diagnostic
      const diagVal = await AsyncStorage.getItem(STORAGE_KEYS.DIAGNOSTIC_LAST_OK).catch(() => null);
      if (isMountedRef.current) setHasDiagOk(diagVal === "true");
    } catch {
      // ignore
    }
  }, [buildProfile]);

  useEffect(() => {
    refreshPreconditions().catch(() => {});
  }, [refreshPreconditions]);

  return {
    hasTokens,
    hasSigningKey,
    hasDiagOk,
    refreshPreconditions,
  };
}
