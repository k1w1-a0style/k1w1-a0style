import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { BuildProfile } from "../types";
import { getExpoToken, getGitHubToken } from "../../../infra/github/githubService";
import {
  STORAGE_KEYS,
  credKeyForProfile,
  credKeyForProjectUiMode,
  resolveProjectCredentialScope,
} from "../../../lib/storageKeys";

/**
 * Centralized precondition checks for Build Screen.
 */
const CI_LITE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function useBuildPreconditions(
  buildProfile: BuildProfile,
  repoFullName: string,
  branchName: string,
  projectData?: { id?: string | null } | null,
) {
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
  const [hasCiLiteOk, setHasCiLiteOk] = useState(false);
  const [ciLiteReason, setCiLiteReason] = useState<string | null>(null);
  const [ciLiteStale, setCiLiteStale] = useState(false);

  const refreshPreconditions = useCallback(async () => {
    try {
      // Tokens
      const [gh, expo] = await Promise.all([
        getGitHubToken().catch(() => ""),
        getExpoToken().catch(() => ""),
      ]);
      if (isMountedRef.current) setHasTokens(!!(gh && expo));

      // Signing key (profile-aware + project-scoped with legacy fallback)
      const keyMode = buildProfile === "development" ? "dev" : buildProfile;
      const projectScope = resolveProjectCredentialScope({
        projectId: projectData?.id,
        linkedRepo: repoFullName,
      });
      const scopedKey = credKeyForProjectUiMode({
        mode: keyMode === "dev" ? "dev" : (keyMode as "preview" | "production"),
        projectScope,
      });
      const legacyKey = credKeyForProfile(
        keyMode === "dev" ? "development" : (keyMode as "preview" | "production"),
      );
      const scopedVal = await AsyncStorage.getItem(scopedKey).catch(() => null);
      const val = scopedVal ?? (scopedKey !== legacyKey ? await AsyncStorage.getItem(legacyKey).catch(() => null) : null);
      if (isMountedRef.current) setHasSigningKey(val === "true");

      // Diagnostic
      const diagVal = await AsyncStorage.getItem(STORAGE_KEYS.DIAGNOSTIC_LAST_OK).catch(() => null);
      if (isMountedRef.current) setHasDiagOk(diagVal === "true");

      // CI Lite must match current repo + branch and must not be stale.
      const [lintOk, typeOk, lastRepo, lastBranch, lastRunAt] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.CI_LITE_LINT_OK).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CI_LITE_TYPECHECK_OK).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CI_LITE_LAST_REPO).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CI_LITE_LAST_BRANCH).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CI_LITE_LAST_RUN_AT).catch(() => null),
      ] as const);

      const repoMatches = (lastRepo ?? "").trim() === (repoFullName ?? "").trim();
      const branchMatches = (lastBranch ?? "").trim() === (branchName ?? "").trim();
      const runTs = Number(lastRunAt ?? "");
      const stale = !Number.isFinite(runTs) || runTs <= 0 || Date.now() - runTs > CI_LITE_MAX_AGE_MS;

      let reason: string | null = null;
      if (lintOk !== "true" || typeOk !== "true") {
        reason = "CI Lite ist nicht grün (Lint/Typecheck).";
      } else if (!repoMatches) {
        reason = "Letzter CI-Lite-Run gehört zu einem anderen Repo.";
      } else if (!branchMatches) {
        reason = "Letzter CI-Lite-Run gehört zu einem anderen Branch.";
      } else if (stale) {
        reason = "Letzter CI-Lite-Run ist veraltet. Bitte erneut prüfen.";
      }

      if (isMountedRef.current) {
        setHasCiLiteOk(
          lintOk === "true" &&
          typeOk === "true" &&
          repoMatches &&
          branchMatches &&
          !stale,
        );
        setCiLiteReason(reason);
        setCiLiteStale(stale);
      }
    } catch {
      // ignore
    }
  }, [branchName, buildProfile, projectData?.id, repoFullName]);

  useEffect(() => {
    refreshPreconditions().catch(() => {});
  }, [refreshPreconditions]);

  return {
    hasTokens,
    hasSigningKey,
    hasDiagOk,
    hasCiLiteOk,
    ciLiteReason,
    ciLiteStale,
    refreshPreconditions,
  };
}
