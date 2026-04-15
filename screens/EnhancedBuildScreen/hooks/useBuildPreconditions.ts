import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import type { BuildProfile } from "../types";
import { getExpoToken, getGitHubToken, getWorkflowAdminKey } from "../../../infra/github/githubService";
import { readBuildReadinessState } from "./buildReadinessState";
import type { VerificationContractState } from "../../../lib/status/verificationContract";
import { readSigningKeyGateState } from "./signingKeyGate";
import { getRepoSyncState, type RepoSyncState } from "../../../lib/repoSyncOrchestration";
import { getMaterializedProjectFiles, getSourceProjectFiles } from "../../../lib/getMaterializedProjectFiles";
import { ensureSupabaseClient } from "../../../lib/supabase";
import { hasLikelyAllowedOperatorRoleForUiPrecheck } from "../../../lib/auth/operatorJwt";

async function readTokenOrUnavailable(read: () => Promise<string | null>): Promise<string | null> {
  try {
    const value = await read();
    const trimmed = String(value ?? "").trim();
    return trimmed || null;
  } catch {
    return null;
  }
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
  const [hasWorkflowAdminKey, setHasWorkflowAdminKey] = useState(false);
  const [workflowAdminKeyReason, setWorkflowAdminKeyReason] = useState<string | null>(null);
  const [hasOperatorJwt, setHasOperatorJwt] = useState(false);
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

    const sourceFiles = getSourceProjectFiles(projectData);
    const files = getMaterializedProjectFiles(projectData);
    const hasFiles = sourceFiles.length > 0;
    const filesReason = hasFiles
      ? null
      : "Projekt ist leer – zuerst Dateien erzeugen oder importieren";

    try {
      // Tokens
      const [gh, expo] = await Promise.all([
        readTokenOrUnavailable(getGitHubToken),
        readTokenOrUnavailable(getExpoToken),
      ]);
      applyIfCurrent(() => setHasTokens(!!(gh && expo)));

      const [workflowAdminKey, operatorJwt] = await Promise.all([
        readTokenOrUnavailable(getWorkflowAdminKey),
        readTokenOrUnavailable(async () => {
          const supabase = await ensureSupabaseClient();
          const session = await supabase.auth.getSession();
          return session?.data?.session?.access_token ?? null;
        }),
      ]);
      applyIfCurrent(() => {
        setHasWorkflowAdminKey(Boolean(workflowAdminKey));
        setWorkflowAdminKeyReason(
          workflowAdminKey
            ? null
            : "Workflow-Admin-Key fehlt – im Verbindungen-Screen setzen",
        );
        // Client-side convenience/readiness precheck only (decode-only JWT payload read).
        // Authoritative auth remains server-/edge-side.
        const hasValidOperatorJwt = hasLikelyAllowedOperatorRoleForUiPrecheck(operatorJwt);
        setHasOperatorJwt(hasValidOperatorJwt);
        setOperatorJwtReason(
          !operatorJwt
            ? "Supabase Operator-JWT fehlt – clientseitiger Readiness-Precheck kann lokal nicht erfüllt werden. Der Client liest JWT-Claims nur decode-only aus der Payload (ohne Signaturprüfung); maßgeblich bleibt die serverseitige/edge-seitige Autorisierungsprüfung."
            : !hasValidOperatorJwt
              ? "Supabase JWT-Payload-Rolle nicht build_admin/service_role – clientseitiger Precheck nicht erfüllt (decode-only, ohne Signaturprüfung; serverseitige/edge-seitige Autorisierungsprüfung bleibt maßgeblich)"
              : null,
        );
      });

      const signingGate = await readSigningKeyGateState({
        buildProfile,
        repoFullName,
        projectData,
      });
      applyIfCurrent(() => {
        setHasSigningKey(signingGate.hasSigningKey);
        setSigningKeyReason(signingGate.reason);
      });

      const hasSelection = !!repoFullName.trim() && !!branchName.trim();
      const readiness = hasSelection
        ? await readBuildReadinessState({
            repoFullName,
            branchName,
          })
        : {
            hasDiagOk: false,
            hasCiLiteOk: false,
            diagnosticState: "unknown" as const,
            diagnosticReason: "Repo und Branch zuerst wählen – dann Diagnostik für genau diese Selection ausführen",
            ciLiteReason: "Repo und Branch zuerst wählen – dann CI-Lite für genau diese Selection ausführen",
            ciLiteState: "unknown" as const,
            ciLiteStale: false,
          };

      const syncState = !repoFullName.trim() || !branchName.trim()
        ? "unknown"
        : !hasFiles
          ? "unknown"
          : await getRepoSyncState({
              linkedRepo: repoFullName,
              linkedBranch: branchName,
              files,
            }).catch(() => "unknown" as RepoSyncState);
      const syncReason = !repoFullName.trim() || !branchName.trim()
        ? "Repo/Branch fehlen – Sync-Status kann noch nicht bestimmt werden"
        : !hasFiles
          ? "Projekt ist leer – Repo-Sync ist fuer ein leeres Projekt nicht build-relevant"
          : syncState === "unknown"
            ? "Repo-Sync-Status unklar – bitte einmal explizit pushen und danach erneut prüfen"
            : syncState === "out_of_sync"
              ? "Lokale Änderungen werden beim Build-Start kontrolliert gepusht"
              : null;

      applyIfCurrent(() => {
        setHasDiagOk(readiness.hasDiagOk);
        setHasCiLiteOk(readiness.hasCiLiteOk);
        setDiagnosticState(readiness.diagnosticState);
        setDiagnosticReason(readiness.diagnosticReason);
        setCiLiteReason(readiness.ciLiteReason);
        setCiLiteState(readiness.ciLiteState);
        setCiLiteStale(readiness.ciLiteStale);
        setHasProjectFiles(hasFiles);
        setProjectFilesReason(filesReason);
        setRepoSyncState(syncState);
        setRepoSyncReason(syncReason);
      });
    } catch (error) {
      console.warn("[useBuildPreconditions] refresh failed; applying fail-closed defaults", error);
      applyIfCurrent(() => {
        setHasSigningKey(false);
        setSigningKeyReason("Build-Vorbedingungen konnten nicht frisch geladen werden – Signing Key erneut prüfen");
        setHasWorkflowAdminKey(false);
        setWorkflowAdminKeyReason("Build-Vorbedingungen konnten nicht frisch geladen werden – Workflow-Admin-Key erneut prüfen");
        setHasOperatorJwt(false);
        setOperatorJwtReason("Build-Vorbedingungen konnten nicht frisch geladen werden – Supabase Operator-Login erneut prüfen");
        setHasDiagOk(false);
        setDiagnosticState("unknown");
        setDiagnosticReason("Build-Vorbedingungen konnten nicht frisch geladen werden – Diagnostik erneut prüfen");
        setHasCiLiteOk(false);
        setCiLiteReason("Build-Vorbedingungen konnten nicht frisch geladen werden – CI-Lite erneut prüfen");
        setCiLiteState("unknown");
        setCiLiteStale(false);
        setHasProjectFiles(hasFiles);
        setProjectFilesReason(filesReason);
        setRepoSyncState("unknown");
        setRepoSyncReason("Build-Vorbedingungen konnten nicht frisch geladen werden – Repo-Sync erneut prüfen");
      });
    }
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
    hasWorkflowAdminKey,
    workflowAdminKeyReason,
    hasOperatorJwt,
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
