import { useEffect } from "react";

import { requireSupabaseEdgeUrl } from "../../../lib/supabaseEdge";
import { fetchWithTimeout } from "../../../lib/network/fetchWithTimeout";
import { SUPABASE_EDGE_FUNCTIONS } from "../../../shared/constants/supabase";
import { normalizeCiLiteWorkflowError, readCiLiteErrorResponse } from "./ciLiteWorkflowErrors";
import {
  buildArtifactFetchContextKey,
  parseCiLiteArtifactJson,
  readCiLiteArtifactPayloadCandidate,
  resolveCiLiteArtifactRequest,
  getCiLiteWorkflowErrorMessage,
} from "./useCiLiteWorkflowHelpers";
import type { CiLiteArtifactResult } from "./ciLiteWorkflow.contracts";

type UseCiLiteArtifactFetchParams = {
  githubRepo: string;
  workflowId: string;
  workflowRunId: number | null;
  workflowStatus: string | null | undefined;
  artifactAttemptedContextRef: { current: string | null };
  resolveOperatorAccess: (context: "artifact") => Promise<{ adminKey: string; userJwt: string }>;
  setArtifactLoading: (value: boolean) => void;
  setArtifactError: (value: string | null) => void;
  setArtifactResult: (value: CiLiteArtifactResult | null) => void;
};

export function useCiLiteArtifactFetch({
  githubRepo,
  workflowId,
  workflowRunId,
  workflowStatus,
  artifactAttemptedContextRef,
  resolveOperatorAccess,
  setArtifactLoading,
  setArtifactError,
  setArtifactResult,
}: UseCiLiteArtifactFetchParams) {
  useEffect(() => {
    const artifactContextKey = buildArtifactFetchContextKey({
      githubRepo,
      workflowId,
      workflowRunId,
      workflowStatus: workflowStatus ?? null,
    });

    if (!artifactContextKey || !workflowRunId) return;
    if (artifactAttemptedContextRef.current === artifactContextKey) return;

    setArtifactError(null);
    artifactAttemptedContextRef.current = artifactContextKey;

    let cancelled = false;

    (async () => {
      try {
        setArtifactLoading(true);

        const edgeUrl = await requireSupabaseEdgeUrl();
        const operatorAccess = await resolveOperatorAccess("artifact");
        const { artifactName, filePath } = resolveCiLiteArtifactRequest(workflowId);

        const resp = await fetchWithTimeout(`${edgeUrl}/${SUPABASE_EDGE_FUNCTIONS.GITHUB_RUN_ARTIFACT_JSON}`, {
          timeoutMs: 15_000,
          timeoutMessage: "CI-Lite-Artefakt konnte nicht rechtzeitig geladen werden. Bitte erneut versuchen.",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${operatorAccess.userJwt}`,
            "x-k1w1-admin-key": operatorAccess.adminKey,
          },
          body: JSON.stringify({
            githubRepo,
            runId: workflowRunId,
            artifactName,
            filePath,
          }),
        });

        const { payload: data, text: raw } = await readCiLiteErrorResponse(resp);
        if (!resp.ok) {
          const normalized = normalizeCiLiteWorkflowError({
            context: "artifact",
            adminKey: operatorAccess.adminKey,
            statusCode: resp.status,
            statusText: resp.statusText,
            payload: data,
            text: raw,
          });
          throw new Error(normalized.userMessage);
        }

        const jsonCandidate = readCiLiteArtifactPayloadCandidate(data);
        const artifactJson = parseCiLiteArtifactJson(jsonCandidate);
        if (!cancelled) {
          setArtifactResult(artifactJson);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setArtifactError(getCiLiteWorkflowErrorMessage(error, "CI-Lite-Artefakt konnte nicht ausgewertet werden."));
        }
      } finally {
        if (!cancelled) setArtifactLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    artifactAttemptedContextRef,
    githubRepo,
    resolveOperatorAccess,
    setArtifactError,
    setArtifactLoading,
    setArtifactResult,
    workflowId,
    workflowRunId,
    workflowStatus,
  ]);
}
