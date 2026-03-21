import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import type { BuildProfile } from "../types";
import { getExpoToken, getGitHubToken } from "../../../infra/github/githubService";
import { readBuildReadinessState } from "./buildReadinessState";
import type { VerificationContractState } from "../../../lib/status/verificationContract";
import { readSigningKeyGateState } from "./signingKeyGate";

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
  const [signingKeyReason, setSigningKeyReason] = useState<string | null>(null);
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

      const signingGate = await readSigningKeyGateState({
        buildProfile,
        repoFullName,
        projectData,
      });
      if (isMountedRef.current) {
        setHasSigningKey(signingGate.hasSigningKey);
        setSigningKeyReason(signingGate.reason);
      }

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

  useFocusEffect(
    useCallback(() => {
      refreshPreconditions().catch(() => {});
      return undefined;
    }, [refreshPreconditions]),
  );

  return {
    hasTokens,
    hasSigningKey,
    hasDiagOk,
    signingKeyReason,
    hasCiLiteOk,
    diagnosticState,
    diagnosticReason,
    ciLiteReason,
    ciLiteState,
    ciLiteStale,
    refreshPreconditions,
  };
}
