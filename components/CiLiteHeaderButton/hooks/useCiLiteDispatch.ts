import { useCallback } from "react";
import { Alert } from "react-native";
import { v4 as uuidv4 } from "uuid";

import { requireSupabaseEdgeUrl } from "../../../lib/supabaseEdge";
import { fetchWithTimeout } from "../../../lib/network/fetchWithTimeout";
import { SUPABASE_EDGE_FUNCTIONS } from "../../../shared/constants/supabase";
import type { ProjectFile } from "../../../shared/types/project";
import { getBranchHeadSha } from "../../../infra/github/githubService";
import { getRepoSyncState } from "../../../lib/repoSyncOrchestration";
import { logger } from "../../../lib/logger";
import { buildEdgeOwnerAuthHeaders } from "../../../lib/edgeOwnerAuthHeaders";
import { normalizeCiLiteWorkflowError, readCiLiteErrorResponse } from "./ciLiteWorkflowErrors";
import {
  resolveCiLiteDispatchSelection,
  resolveCiLiteSyncStateError,
} from "./useCiLiteWorkflowContracts";

type UseCiLiteDispatchParams = {
  dispatching: boolean;
  githubRepo: string;
  branch: string;
  projectFiles: ProjectFile[];
  resolveOperatorAccess: (context: "dispatch") => Promise<{ authMode: "jwt" | "ownerFallback"; adminKey: string | null; userJwt: string | null }>;
  startLookupTracking: (params: {
    githubRepo: string;
    branch: string;
    jobId: string;
    workflow: string;
    userJwt: string | null;
    expectedEvent: "workflow_dispatch";
    sourceHeadSha?: string | null;
    mode: "default";
  }) => Promise<void>;
  stopLookupWithError: (error: unknown) => void;
  stopRunLookup: () => void;
  updateLookupDiagnosis: (diagnosis: null) => void;
  setLocalError: (value: string | null) => void;
  setVisible: (value: boolean) => void;
  setDispatching: (value: boolean) => void;
  setRunId: (value: number | null) => void;
  setRunUrl: (value: string | null) => void;
  setWorkflowId: (value: string) => void;
  setChainWaiting: (value: boolean) => void;
  setJobId: (value: string | null) => void;
  setTargetRef: (value: string | null) => void;
};

export function useCiLiteDispatch(params: UseCiLiteDispatchParams) {
  return useCallback(
    async (workflowFile: string) => {
      if (params.dispatching) return;

      const dispatchSelection = resolveCiLiteDispatchSelection({
        githubRepo: params.githubRepo,
        branch: params.branch,
      });
      if (!dispatchSelection.ok) {
        Alert.alert("CI Lite", dispatchSelection.message);
        return;
      }
      const { owner, repo, branch: targetBranch } = dispatchSelection.selection;

      params.setLocalError(null);
      params.setVisible(true);
      params.setDispatching(true);
      params.setRunId(null);
      params.setRunUrl(null);
      params.setWorkflowId(workflowFile);
      params.setChainWaiting(false);
      params.updateLookupDiagnosis(null);
      params.stopRunLookup();

      const newJobId = uuidv4();
      params.setJobId(newJobId);

      try {
        const syncState = await getRepoSyncState({
          linkedRepo: params.githubRepo,
          linkedBranch: targetBranch,
          files: params.projectFiles,
        });
        const syncStateError = resolveCiLiteSyncStateError(syncState);
        if (syncStateError) {
          throw new Error(syncStateError);
        }
        params.setTargetRef(targetBranch);

        const sourceHeadSha = await getBranchHeadSha(owner, repo, targetBranch).catch((error: unknown) => {
          logger.warn("[CiLiteDispatch] getBranchHeadSha failed, continuing without sourceHeadSha", {
            owner,
            repo,
            targetBranch,
            error,
          });
          return null;
        });

        const operatorAccess = await params.resolveOperatorAccess("dispatch");
        const edgeUrl = await requireSupabaseEdgeUrl();
        const r = await fetchWithTimeout(`${edgeUrl}/${SUPABASE_EDGE_FUNCTIONS.GITHUB_WORKFLOW_DISPATCH}`, {
          timeoutMs: 15_000,
          timeoutMessage: "Workflow-Dispatch hat das Zeitlimit erreicht. Bitte erneut versuchen.",
          method: "POST",
          headers: await buildEdgeOwnerAuthHeaders({
            action: "CI Lite Dispatch",
            userJwt: operatorAccess.userJwt,
            adminKey: operatorAccess.adminKey,
          }),
          body: JSON.stringify({
            githubRepo: params.githubRepo,
            workflow: workflowFile,
            ref: targetBranch,
            // GitHub workflow_dispatch requires the target ref twice:
            // - top-level `ref` selects the branch/SHA to run on
            // - `inputs.ref` satisfies the workflow's declared input contract
            inputs: { ref: targetBranch, job_id: newJobId },
          }),
        });

        if (!r.ok) {
          const { payload, text } = await readCiLiteErrorResponse(r);
          const normalized = normalizeCiLiteWorkflowError({
            context: "dispatch",
            authMode: operatorAccess.authMode,
            adminKey: operatorAccess.adminKey,
            statusCode: r.status,
            statusText: r.statusText,
            payload,
            text,
          });
          throw new Error(normalized.userMessage);
        }

        await params.startLookupTracking({
          githubRepo: params.githubRepo,
          branch: targetBranch,
          jobId: newJobId,
          workflow: workflowFile,
          userJwt: operatorAccess.userJwt,
          expectedEvent: "workflow_dispatch",
          sourceHeadSha,
          mode: "default",
        });
      } catch (error: unknown) {
        params.stopLookupWithError(error);
      } finally {
        params.setDispatching(false);
      }
    },
    [params],
  );
}
