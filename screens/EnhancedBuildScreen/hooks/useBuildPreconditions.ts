import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import type { BuildProfile } from "../types";
import { getExpoToken, getGitHubToken, getWorkflowAdminKey } from "../../../infra/github/githubService";
import { readBuildReadinessState } from "./buildReadinessState";
import type { VerificationContractState } from "../../../lib/status/verificationContract";
import { readSigningKeyGateState } from "./signingKeyGate";
import { getRepoSyncState, type RepoSyncState } from "../../../lib/repoSyncOrchestration";
import { getCanonicalProjectFilesForOps } from "../../../lib/getMaterializedProjectFiles";
import { ensureSupabaseClient } from "../../../lib/supabase";
import { hasLikelyAllowedOperatorRoleForUiPrecheck } from "../../../lib/auth/operatorJwt";

type SecretReadState = "present" | "missing" | "unreadable";

type SecretReadResult = {
  value: string | null;
  state: SecretReadState;
};

export type LocalBuildGateState = {
  hasTokens: boolean;
  tokenReason: string | null;
  hasWorkflowAdminKey: boolean;
  workflowAdminKeyReason: string | null;
  hasOperatorJwt: boolean;
  verifiedOperatorAccess: boolean;
  operatorJwtReason: string | null;
};

async function readSecretForPrecheck(read: () => Promise<string | null>): Promise<SecretReadResult> {
  try {
    const value = await read();
    const trimmed = String(value ?? "").trim();
    return trimmed
      ? { value: trimmed, state: "present" }
      : { value: null, state: "missing" };
  } catch (error: unknown) {
    console.warn("[useBuildPreconditions] secret read failed", error);
    return { value: null, state: "unreadable" };
  }
}

export async function readLocalBuildGateState(): Promise<LocalBuildGateState> {
  const [ghResult, expoResult] = await Promise.all([
    readSecretForPrecheck(getGitHubToken),
    readSecretForPrecheck(getExpoToken),
  ]);
  const [workflowAdminKeyResult, operatorJwtResult] = await Promise.all([
    readSecretForPrecheck(getWorkflowAdminKey),
    readSecretForPrecheck(async () => {
      const supabase = await ensureSupabaseClient();
      const session = await supabase.auth.getSession();
      return session?.data?.session?.access_token ?? null;
    }),
  ]);
  const hasTokens = Boolean(ghResult.value && expoResult.value);
  const hasWorkflowAdminKey = Boolean(workflowAdminKeyResult.value);
  const hasValidOperatorJwt = hasLikelyAllowedOperatorRoleForUiPrecheck(operatorJwtResult.value);
  const hasOwnerAdminFallback = hasWorkflowAdminKey;
  const verifiedOperatorAccess = hasValidOperatorJwt || hasOwnerAdminFallback;
  return {
    hasTokens,
    tokenReason:
      ghResult.state === "unreadable" || expoResult.state === "unreadable"
        ? "GitHub-/Expo-Token konnten nicht gelesen werden (SecureStore/Storage-Read fehlgeschlagen) – Verbindungen laden und Read erneut prüfen"
        : ghResult.state === "missing" || expoResult.state === "missing"
          ? "Tokens fehlen (GitHub + Expo) – im Verbindungen-Screen setzen"
          : null,
    hasWorkflowAdminKey,
    workflowAdminKeyReason:
      workflowAdminKeyResult.state === "present"
        ? null
        : workflowAdminKeyResult.state === "missing"
          ? "Workflow-Admin-Key fehlt – im Verbindungen-Screen setzen"
          : "Workflow-Admin-Key konnte nicht gelesen werden (SecureStore/Storage-Read fehlgeschlagen) – lokalen Read prüfen und erneut laden",
    hasOperatorJwt: operatorJwtResult.state === "present" && hasValidOperatorJwt,
    verifiedOperatorAccess,
    operatorJwtReason:
      verifiedOperatorAccess
        ? null
        : operatorJwtResult.state === "missing"
          ? "Supabase Operator-JWT fehlt und kein Owner/Admin-Fallback gefunden – clientseitiger Readiness-Precheck nicht erfüllt."
          : operatorJwtResult.state === "unreadable"
            ? "Supabase Session/JWT konnte nicht gelesen werden und kein Owner/Admin-Fallback ist verfügbar – clientseitiger Precheck fail-closed"
            : !hasValidOperatorJwt
              ? "Supabase JWT ist vorhanden, aber Rolle nicht berechtigt (unauthorized: erwartet build_admin/service_role) und kein Owner/Admin-Fallback ist verfügbar"
              : null,
  };
}

export function useBuildPreconditions(
  buildProfile: BuildProfile,
  repoFullName: string,
  branchName: string,
  projectData?: { id?: string | null; files?: { path: string; content: string }[] | null } | null,
) {
  const isMountedRef = useRef(true);
  const refreshEpochRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [hasTokens, setHasTokens] = useState(false);
  const [tokenReason, setTokenReason] = useState<string | null>(null);
  const [hasWorkflowAdminKey, setHasWorkflowAdminKey] = useState(false);
  const [workflowAdminKeyReason, setWorkflowAdminKeyReason] = useState<string | null>(null);
  const [hasOperatorJwt, setHasOperatorJwt] = useState(false);
  const [verifiedOperatorAccess, setVerifiedOperatorAccess] = useState(false);
  const [operatorJwtReason, setOperatorJwtReason] = useState<string | null>(null);
  const [hasSigningKey, setHasSigningKey] = useState(false);
  const [signingKeyReason, setSigningKeyReason] = useState<string | null>(null);
  const [hasDiagOk, setHasDiagOk] = useState(false);
  const [hasCiLiteOk, setHasCiLiteOk] = useState(false);
  const [diagnosticState, setDiagnosticState] = useState<VerificationContractState>("unknown");
  const [diagnosticReason, setDiagnosticReason] = useState<string | null>(null);
  const [ciLiteReason, setCiLiteReason] = useState<string | null>(null);
  const [ciLiteState, setCiLiteState] = useState<VerificationContractState>("unknown");
  const [ciLiteStale, setCiLiteStale] = useState(false);
  const [repoSyncState, setRepoSyncState] = useState<RepoSyncState>("unknown");
  const [repoSyncReason, setRepoSyncReason] = useState<string | null>(null);
  const [hasProjectFiles, setHasProjectFiles] = useState(false);
  const [projectFilesReason, setProjectFilesReason] = useState<string | null>(null);

  const refreshPreconditions = useCallback(async () => {
    const refreshEpoch = ++refreshEpochRef.current;
    const applyIfCurrent = (apply: () => void) => {
      if (isMountedRef.current && refreshEpochRef.current === refreshEpoch) {
        apply();
      }
    };

    const canonicalFiles = getCanonicalProjectFilesForOps(projectData);
    const hasFiles = canonicalFiles.length > 0;
    const filesReason = hasFiles
      ? null
      : "Projekt ist leer – zuerst Dateien erzeugen oder importieren";

    const localGate = await readLocalBuildGateState();
    applyIfCurrent(() => {
      setHasTokens(localGate.hasTokens);
      setTokenReason(localGate.tokenReason);
      setHasWorkflowAdminKey(localGate.hasWorkflowAdminKey);
      setWorkflowAdminKeyReason(localGate.workflowAdminKeyReason);
      setHasOperatorJwt(localGate.hasOperatorJwt);
      setVerifiedOperatorAccess(localGate.verifiedOperatorAccess);
      setOperatorJwtReason(localGate.operatorJwtReason);
    });

    try {
      const signingGate = await readSigningKeyGateState({
        buildProfile,
        repoFullName,
        projectData,
      });
      applyIfCurrent(() => {
        setHasSigningKey(signingGate.hasSigningKey);
        setSigningKeyReason(signingGate.reason);
      });
    } catch (error: unknown) {
      console.warn("[useBuildPreconditions] signing precheck read failed", error);
      applyIfCurrent(() => {
        setHasSigningKey(false);
        setSigningKeyReason(
          "Signing-Key-Status konnte nicht gelesen werden (Read-/I/O-Fehler) – Credentials-Status erneut laden",
        );
      });
    }

    const hasSelection = !!repoFullName.trim() && !!branchName.trim();
    if (!hasSelection) {
      applyIfCurrent(() => {
        setHasDiagOk(false);
        setHasCiLiteOk(false);
        setDiagnosticState("unknown");
        setDiagnosticReason(
          "selection_missing: Repo und Branch zuerst wählen – dann Diagnostik für genau diese Selection ausführen",
        );
        setCiLiteReason(
          "selection_missing: Repo und Branch zuerst wählen – dann CI-Lite für genau diese Selection ausführen",
        );
        setCiLiteState("unknown");
        setCiLiteStale(false);
        setHasProjectFiles(hasFiles);
        setProjectFilesReason(filesReason);
        setRepoSyncState("unknown");
        setRepoSyncReason("selection_missing: Repo/Branch fehlen – Sync-Status kann noch nicht bestimmt werden");
      });
      return;
    }

    try {
      const readiness = await readBuildReadinessState({
        repoFullName,
        branchName,
        projectFiles: canonicalFiles,
      });
      applyIfCurrent(() => {
        setHasDiagOk(readiness.hasDiagOk);
        setHasCiLiteOk(readiness.hasCiLiteOk);
        setDiagnosticState(readiness.diagnosticState);
        setDiagnosticReason(readiness.diagnosticReason);
        setCiLiteReason(readiness.ciLiteReason);
        setCiLiteState(readiness.ciLiteState);
        setCiLiteStale(readiness.ciLiteStale);
      });
    } catch (error: unknown) {
      console.warn("[useBuildPreconditions] readiness precheck read failed", error);
      applyIfCurrent(() => {
        setHasDiagOk(false);
        setDiagnosticState("unknown");
        setDiagnosticReason(
          "Diagnostik-Readiness konnte nicht geladen werden (Read-/Storage-Fehler) – bitte erneut prüfen",
        );
        setHasCiLiteOk(false);
        setCiLiteReason(
          "CI-Lite-Readiness konnte nicht geladen werden (Read-/Storage-Fehler) – bitte erneut prüfen",
        );
        setCiLiteState("unknown");
        setCiLiteStale(false);
      });
    }

    let syncState: RepoSyncState = "unknown";
    if (hasFiles) {
      try {
        syncState = await getRepoSyncState({
          linkedRepo: repoFullName,
          linkedBranch: branchName,
          files: canonicalFiles,
        });
      } catch (error: unknown) {
        console.warn("[useBuildPreconditions] repo sync precheck read failed", error);
        syncState = "unknown";
      }
    }
    const syncReason = !hasFiles
      ? "Projekt ist leer – Repo-Sync ist fuer ein leeres Projekt nicht build-relevant"
      : syncState === "unknown"
        ? "repo_sync_unknown: Repo-Sync-Status konnte nicht sicher gelesen werden (Read-/Sync-Fehler) – bitte explizit pushen und erneut prüfen"
        : syncState === "out_of_sync"
          ? "Lokale Änderungen werden beim Build-Start kontrolliert gepusht"
          : null;
    applyIfCurrent(() => {
      setHasProjectFiles(hasFiles);
      setProjectFilesReason(filesReason);
      setRepoSyncState(syncState);
      setRepoSyncReason(syncReason);
    });
  }, [branchName, buildProfile, projectData?.id, projectData?.files, repoFullName]);

  useEffect(() => {
    refreshPreconditions().catch((error) => {
      console.warn("[useBuildPreconditions] initial refresh failed", error);
    });
  }, [refreshPreconditions]);

  useFocusEffect(
    useCallback(() => {
      refreshPreconditions().catch((error) => {
        console.warn("[useBuildPreconditions] focus refresh failed", error);
      });
      return undefined;
    }, [refreshPreconditions]),
  );

  return {
    hasTokens,
    tokenReason,
    hasWorkflowAdminKey,
    workflowAdminKeyReason,
    hasOperatorJwt,
    verifiedOperatorAccess,
    operatorJwtReason,
    hasSigningKey,
    hasDiagOk,
    signingKeyReason,
    hasCiLiteOk,
    diagnosticState,
    diagnosticReason,
    ciLiteReason,
    ciLiteState,
    ciLiteStale,
    repoSyncState,
    repoSyncReason,
    hasProjectFiles,
    projectFilesReason,
    refreshPreconditions,
  };
}
