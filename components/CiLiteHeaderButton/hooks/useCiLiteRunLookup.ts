import { useCallback } from "react";

import { requireSupabaseEdgeUrl } from "../../../lib/supabaseEdge";
import { fetchWithTimeout } from "../../../lib/network/fetchWithTimeout";
import { SUPABASE_EDGE_FUNCTIONS } from "../../../shared/constants/supabase";
import { getWorkflowAdminKey } from "../../../infra/github/githubService";
import { logger } from "../../../lib/logger";
import { buildEdgeOwnerAuthHeaders } from "../../../lib/edgeOwnerAuthHeaders";
import { isLikelyWellFormedAdminKeyForUiPrecheck } from "../../../lib/security/isLikelyWellFormedAdminKeyForUiPrecheck";
import { chooseWorkflowRunCandidateDetailed, type WorkflowRunLookupDiagnosis } from "./workflowRunMatching";
import { normalizeCiLiteWorkflowError, readCiLiteErrorResponse } from "./ciLiteWorkflowErrors";
import {
  hasCiLiteLookupTimedOut,
  resolveCiLiteLookupFailureLabel,
} from "./useCiLiteWorkflowHelpers";
import { resolveCiLiteMatchedRun } from "./useCiLiteWorkflowContracts";

import type { CiLiteLookupFailureMessageBuilder, CiLiteLookupTrackingParams } from "./ciLiteWorkflow.contracts";

type UseCiLiteRunLookupParams = {
  buildLookupFailureMessage: CiLiteLookupFailureMessageBuilder;
  startRunLookup: () => number;
  stopRunLookup: () => void;
  isLookupGenerationActive: (generation: number) => boolean;
  scheduleLookupPoll: (params: { generation: number; attempt: number; poll: () => Promise<boolean> }) => void;
  updateLookupDiagnosis: (diagnosis: WorkflowRunLookupDiagnosis | null) => void;
  stopLookupWithError: (error: unknown, options?: { chainWaiting?: boolean }) => void;
  setRunId: (runId: number | null) => void;
  setRunUrl: (runUrl: string | null) => void;
};

export function useCiLiteRunLookup(params: UseCiLiteRunLookupParams) {
  const findMatchingRun = useCallback(
    async (opts: {
      githubRepo: string;
      branch: string;
      jobId: string;
      workflow: string;
      userJwt: string | null;
      expectedEvent: "repository_dispatch" | "workflow_dispatch";
      startedAtMs: number;
      sourceHeadSha?: string | null;
      requireJobIdMarker?: boolean;
    }) => {
      const edgeUrl = await requireSupabaseEdgeUrl();
      const workflowAdminKey = await getWorkflowAdminKey().catch((error: unknown) => {
        logger.warn("[CiLiteRunLookup] getWorkflowAdminKey failed", { error });
        return null;
      });
      const trimmedWorkflowAdminKey = String(workflowAdminKey ?? "").trim();
      if (!trimmedWorkflowAdminKey || !isLikelyWellFormedAdminKeyForUiPrecheck(trimmedWorkflowAdminKey)) {
        const normalized = normalizeCiLiteWorkflowError({
          context: "lookup",
          adminKey: trimmedWorkflowAdminKey,
        });
        throw new Error(normalized.userMessage);
      }

      const r = await fetchWithTimeout(`${edgeUrl}/${SUPABASE_EDGE_FUNCTIONS.GITHUB_WORKFLOW_RUNS}`, {
        timeoutMs: 15_000,
        timeoutMessage: "Workflow-Run-Lookup hat das Zeitlimit erreicht. Bitte erneut versuchen.",
        method: "POST",
        headers: await buildEdgeOwnerAuthHeaders({
          action: "CI Lite Workflow-Run-Lookup",
          userJwt: opts.userJwt,
          adminKey: trimmedWorkflowAdminKey,
        }),
        body: JSON.stringify({ githubRepo: opts.githubRepo, workflowId: opts.workflow, ref: opts.branch, perPage: 30 }),
      });

      if (!r.ok) {
        const { payload, text } = await readCiLiteErrorResponse(r);
        const normalized = normalizeCiLiteWorkflowError({
          context: "lookup",
          adminKey: trimmedWorkflowAdminKey,
          statusCode: r.status,
          statusText: r.statusText,
          payload,
          text,
        });
        throw new Error(normalized.userMessage);
      }

      const json = await r.json();
      const workflowLookupNote = typeof json?.note === "string" ? json.note.trim() : "";
      // Workflow-Run-Lookup ist nicht workflow-spezifisch abgesichert => harter Vertrags-/Sicherheitsfehler.
      if (workflowLookupNote) {
        const normalized = normalizeCiLiteWorkflowError({
          context: "lookup",
          adminKey: trimmedWorkflowAdminKey,
          note: workflowLookupNote,
        });
        throw new Error(normalized.userMessage);
      }

      const runs = json?.data?.workflow_runs ?? json?.workflow_runs ?? json?.runs ?? [];
      if (!Array.isArray(runs)) {
        return {
          candidate: null,
          diagnosis: {
            exactJobIdMatchFound: false,
            fallbackCandidateCount: 0,
            ambiguous: false,
            contractMismatchLikely: false,
            plausibleCandidateCount: 0,
            selectedTier: null,
          },
        };
      }

      return chooseWorkflowRunCandidateDetailed(runs, opts);
    },
    [],
  );

  return useCallback(
    async (lookupParams: CiLiteLookupTrackingParams) => {
      const lookupGeneration = params.startRunLookup();
      const start = Date.now();

      const poll = async () => {
        try {
          const lookup = await findMatchingRun({
            githubRepo: lookupParams.githubRepo,
            branch: lookupParams.branch,
            jobId: lookupParams.jobId,
            workflow: lookupParams.workflow,
            userJwt: lookupParams.userJwt,
            expectedEvent: lookupParams.expectedEvent,
            startedAtMs: start,
            sourceHeadSha: lookupParams.sourceHeadSha,
            requireJobIdMarker: true,
          });
          if (!params.isLookupGenerationActive(lookupGeneration)) return true;

          params.updateLookupDiagnosis(lookup.diagnosis);
          const matchedRun = resolveCiLiteMatchedRun(lookup.candidate);
          if (matchedRun) {
            params.setRunId(matchedRun.runId);
            params.setRunUrl(matchedRun.runUrl);
            lookupParams.onMatch?.();
            params.stopRunLookup();
            return true;
          }
        } catch (error: unknown) {
          params.stopLookupWithError(error, lookupParams.stopLookupOptions);
          return true;
        }

        if (hasCiLiteLookupTimedOut({ startedAtMs: start, mode: lookupParams.mode })) {
          params.stopLookupWithError(
            params.buildLookupFailureMessage({ workflowLabel: resolveCiLiteLookupFailureLabel(lookupParams.mode) }),
            lookupParams.stopLookupOptions,
          );
          return true;
        }
        return false;
      };

      const lookupFinished = await poll();
      if (!lookupFinished) {
        params.scheduleLookupPoll({ generation: lookupGeneration, attempt: 0, poll });
      }
    },
    [findMatchingRun, params],
  );
}
