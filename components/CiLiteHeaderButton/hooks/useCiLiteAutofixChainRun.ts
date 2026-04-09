import { useEffect } from "react";

import { WORKFLOW_CI_LITE, WORKFLOW_CI_LITE_AUTOFIX } from "../types";
import { resolveCiLiteMissingJwtMessage } from "./useCiLiteWorkflowContracts";
import { getAutofixChainSkipReason } from "./useCiLiteWorkflowHelpers";
import { readOperatorJwt } from "./useCiLiteWorkflowAccess";

type ChainDeps = {
  workflowId: string;
  workflowRun: { status?: string | null; conclusion?: string | null; head_sha?: string | null } | null;
  jobId: string | null;
  githubRepo: string;
  targetRef: string | null;
  branch: string;
  chainWaiting: boolean;
  logLines: string[];
  stopRunLookup: () => void;
  startLookupTracking: (params: {
    githubRepo: string;
    branch: string;
    jobId: string;
    workflow: string;
    userJwt: string;
    expectedEvent: "repository_dispatch";
    sourceHeadSha: string | null;
    mode: "chain";
    onMatch: () => void;
    stopLookupOptions: { chainWaiting: true };
  }) => Promise<void>;
  setLocalError: (value: string) => void;
  setChainWaiting: (value: boolean) => void;
  setWorkflowId: (value: string) => void;
  setRunId: (value: number | null) => void;
  setRunUrl: (value: string | null) => void;
};

export function useCiLiteAutofixChainRun(deps: ChainDeps) {
  const {
    workflowId,
    workflowRun,
    jobId,
    githubRepo,
    targetRef,
    branch,
    chainWaiting,
    logLines,
    stopRunLookup,
    startLookupTracking,
    setLocalError,
    setChainWaiting,
    setWorkflowId,
    setRunId,
    setRunUrl,
  } = deps;

  useEffect(() => {
    if (workflowId !== WORKFLOW_CI_LITE_AUTOFIX || !workflowRun) return;
    if (workflowRun.status !== "completed" || workflowRun.conclusion !== "success") return;
    if (!jobId || !githubRepo || chainWaiting) return;

    const b = (targetRef || branch || "").trim();
    if (!b) return;

    const chainSkipReason = getAutofixChainSkipReason(logLines);
    if (chainSkipReason) {
      setLocalError(`Autofix erfolgreich, aber CI-Lite Chain-Run wurde im Workflow übersprungen: ${chainSkipReason}.`);
      setChainWaiting(false);
      stopRunLookup();
      return;
    }

    setChainWaiting(true);
    setWorkflowId(WORKFLOW_CI_LITE);
    setRunId(null);
    setRunUrl(null);

    void (async () => {
      const userJwt = await readOperatorJwt("lookup");
      if (!userJwt) {
        setLocalError(resolveCiLiteMissingJwtMessage("lookup"));
        setChainWaiting(false);
        stopRunLookup();
        return;
      }

      await startLookupTracking({
        githubRepo,
        branch: b,
        jobId,
        workflow: WORKFLOW_CI_LITE,
        userJwt,
        expectedEvent: "repository_dispatch",
        sourceHeadSha: workflowRun.head_sha ?? null,
        mode: "chain",
        onMatch: () => {
          setChainWaiting(false);
        },
        stopLookupOptions: { chainWaiting: true },
      });
    })();
  }, [
    workflowId,
    workflowRun,
    jobId,
    githubRepo,
    targetRef,
    branch,
    chainWaiting,
    logLines,
    stopRunLookup,
    startLookupTracking,
    setLocalError,
    setChainWaiting,
    setWorkflowId,
    setRunId,
    setRunUrl,
  ]);
}
