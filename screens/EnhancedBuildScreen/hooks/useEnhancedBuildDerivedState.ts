import { useMemo } from "react";

import type { BuildStatus } from "../../../shared/types/build";
import type { CheckItem } from "../components/ChecklistSection";
import type {
  BuildProfile,
  CurrentBuildLike,
  WorkflowRun,
} from "../types";
import {
  resolveLogsLoadContext,
  validateRepoFullName,
} from "./buildScreenHelpers";
import {
  createChecklistItems,
  resolveBuildBlockedAction,
  type BuildBlockedAction,
} from "./enhancedBuildScreenReadiness";
import {
  filterWorkflowRunsByProfile,
  getWorkflowRunsEmptyStateText,
  type ModeFilter,
} from "./runFilterState";

const REPO_MISSING_BLOCK_REASON = "Repo fehlt (im GitHub-Repos-Screen verknuepfen)";
const BRANCH_MISSING_BLOCK_REASON = "Branch fehlt (im GitHub-Repos-Screen auswaehlen)";

export const useEnhancedBuildDerivedState = (params: {
  repoFullName: string;
  branchName: string;
  buildProfile: BuildProfile;
  actionsFilter: ModeFilter;
  runs: WorkflowRun[];
  projectData: { files?: unknown[] } | null;
  currentBuild: CurrentBuildLike | null;
  runId: number | null;
  status: BuildStatus;
  hasTokens: boolean;
  hasWorkflowAdminKey: boolean;
  workflowAdminKeyReason: string | null;
  hasOperatorJwt: boolean;
  operatorJwtReason: string | null;
  hasSigningKey: boolean;
  signingKeyReason: string | null;
  hasDiagOk: boolean;
  hasCiLiteOk: boolean;
  diagnosticReason: string | null;
  ciLiteReason: string | null;
  repoSyncState: "unknown" | "in_sync" | "out_of_sync";
  repoSyncReason: string | null;
  hasProjectFiles: boolean;
  projectFilesReason: string | null;
}) => {
  const repoValidation = useMemo(() => validateRepoFullName(params.repoFullName), [params.repoFullName]);
  const normalizedRepo = repoValidation.normalized;

  const buildBlockedReason = useMemo(() => {
    if (!repoValidation.valid) return REPO_MISSING_BLOCK_REASON;
    if (!params.branchName.trim()) return BRANCH_MISSING_BLOCK_REASON;
    if (!params.hasTokens) return "Tokens fehlen (GitHub + Expo) – im Verbindungen-Screen setzen";
    if (!params.hasWorkflowAdminKey) return params.workflowAdminKeyReason || "Workflow-Admin-Key fehlt";
    if (!params.hasOperatorJwt) {
      return params.operatorJwtReason || "Supabase Operator-JWT-Precheck fehlt (clientseitig); server-/edge-seitige Autorisierung bleibt maßgeblich";
    }
    if (!params.hasProjectFiles) return params.projectFilesReason || "Projekt ist leer – zuerst Dateien erzeugen oder importieren";
    if (!params.hasDiagOk) return params.diagnosticReason || "Diagnostik noch nicht sicher bestaetigt – im Diagnostic-Screen ausfuehren";
    if (!params.hasCiLiteOk) {
      return params.ciLiteReason || "CI Lite nicht gruen oder nicht passend zu Repo/Branch – im Header ausfuehren";
    }
    if (params.repoSyncState === "unknown") {
      return params.repoSyncReason || "Repo-Sync-Status unklar – bitte Repo-Änderungen explizit pushen und danach erneut prüfen";
    }
    if (!params.hasSigningKey) return params.signingKeyReason || "Signing Key fehlt – im Wizard generieren";
    return null;
  }, [params, repoValidation.valid]);

  const buildBlockedAction = useMemo<BuildBlockedAction | null>(() => {
    return resolveBuildBlockedAction({
      repoValidationValid: repoValidation.valid,
      branchName: params.branchName,
      hasTokens: params.hasTokens,
      hasWorkflowAdminKey: params.hasWorkflowAdminKey,
      hasOperatorJwt: params.hasOperatorJwt,
      hasDiagOk: params.hasDiagOk,
      hasCiLiteOk: params.hasCiLiteOk,
      repoSyncState: params.repoSyncState,
      hasSigningKey: params.hasSigningKey,
      buildBlockedReason,
    });
  }, [repoValidation.valid, params.branchName, params.hasTokens, params.hasWorkflowAdminKey, params.hasOperatorJwt, params.hasDiagOk, params.hasCiLiteOk, params.repoSyncState, params.hasSigningKey, buildBlockedReason]);

  const {
    shouldLoadLogs,
    githubRepoForLogs,
    logsWaitingReason,
  } = useMemo(() => resolveLogsLoadContext({
    selectedRepoFullName: normalizedRepo,
    currentBuildRepoFullName: params.currentBuild?.githubRepo ?? null,
    runId: params.runId,
    status: params.status,
  }), [normalizedRepo, params.currentBuild?.githubRepo, params.runId, params.status]);

  const filteredRuns = useMemo(() => {
    return filterWorkflowRunsByProfile(params.runs, params.actionsFilter);
  }, [params.runs, params.actionsFilter]);

  const runsEmptyStateText = useMemo(() => {
    return getWorkflowRunsEmptyStateText({
      actionsFilter: params.actionsFilter,
      filteredRunsCount: filteredRuns.length,
      allRunsCount: params.runs.length,
    });
  }, [params.actionsFilter, filteredRuns.length, params.runs.length]);

  const checklistItems: CheckItem[] = useMemo(() => {
    return createChecklistItems({
      buildProfile: params.buildProfile,
      repoFullName: params.repoFullName,
      branchName: params.branchName,
      hasSigningKey: params.hasSigningKey,
      signingKeyReason: params.signingKeyReason,
      hasTokens: params.hasTokens,
      hasWorkflowAdminKey: params.hasWorkflowAdminKey,
      workflowAdminKeyReason: params.workflowAdminKeyReason,
      hasOperatorJwt: params.hasOperatorJwt,
      operatorJwtReason: params.operatorJwtReason,
      hasDiagOk: params.hasDiagOk,
      diagnosticReason: params.diagnosticReason,
      hasCiLiteOk: params.hasCiLiteOk,
      ciLiteReason: params.ciLiteReason,
      hasProjectFiles: params.hasProjectFiles,
      projectFilesReason: params.projectFilesReason,
      repoSyncState: params.repoSyncState,
      repoSyncReason: params.repoSyncReason,
      projectFilesCount: params.projectData?.files?.length ?? 0,
    });
  }, [params.buildProfile, params.repoFullName, params.branchName, params.hasSigningKey, params.signingKeyReason, params.hasTokens, params.hasWorkflowAdminKey, params.workflowAdminKeyReason, params.hasOperatorJwt, params.operatorJwtReason, params.hasDiagOk, params.diagnosticReason, params.hasCiLiteOk, params.ciLiteReason, params.hasProjectFiles, params.projectFilesReason, params.repoSyncState, params.repoSyncReason, params.projectData?.files?.length]);

  return {
    repoValidation,
    normalizedRepo,
    buildBlockedReason,
    buildBlockedAction,
    shouldLoadLogs,
    githubRepoForLogs,
    logsWaitingReason,
    filteredRuns,
    runsEmptyStateText,
    checklistItems,
  };
};
