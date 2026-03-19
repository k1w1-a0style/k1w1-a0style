import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { BuildProfile } from "../types";
import { getExpoToken, getGitHubToken } from "../../../infra/github/githubService";
import {
  credKeyForProfile,
  credKeyForProjectUiMode,
  resolveProjectCredentialScope,
} from "../../../lib/storageKeys";
import { readBuildReadinessState } from "./buildReadinessState";
import type { VerificationContractState } from "../../../lib/status/verificationContract";

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
  const [diagnosticState, setDiagnosticState] = useState<VerificationContractState>("unknown");
  const [diagnosticReason, setDiagnosticReason] = useState<string | null>(null);
  const [ciLiteReason, setCiLiteReason] = useState<string | null>(null);
  const [ciLiteState, setCiLiteState] = useState<VerificationContractState>("unknown");
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

      const readiness = await readBuildReadinessState({
        repoFullName,
        branchName,
      });

      if (isMountedRef.current) {
        setHasDiagOk(readiness.hasDiagOk);
        setHasCiLiteOk(readiness.hasCiLiteOk);
        setDiagnosticState(readiness.diagnosticState);
        setDiagnosticReason(readiness.diagnosticReason);
        setCiLiteReason(readiness.ciLiteReason);
        setCiLiteState(readiness.ciLiteState);
        setCiLiteStale(readiness.ciLiteStale);
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
    diagnosticState,
    diagnosticReason,
    ciLiteReason,
    ciLiteState,
    ciLiteStale,
    refreshPreconditions,
  };
}
