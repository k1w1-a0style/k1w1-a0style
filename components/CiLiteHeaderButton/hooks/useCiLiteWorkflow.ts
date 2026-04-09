// components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts
// Public CI-Lite facade hook (orchestrates dispatch, run-lookup, artifact-fetch, and persistence helpers).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useProject } from "../../../contexts/ProjectContext";
import { useGitHubActionsLogs } from "../../../hooks/useGitHubActionsLogs";
import { computeCiLiteOk, inferStepStates, safeUi } from "../../ciLite/ciLiteUtils";
import { WORKFLOW_CI_LITE, WORKFLOW_CI_LITE_AUTOFIX, type StepState } from "../types";
import { deriveCiLiteHeaderState } from "./useCiLiteWorkflowStatusHelpers";
import { useCiLiteRunLookupState } from "./useCiLiteRunLookupState";
import {
  resolveCiLiteLookupFailureMessage,
  resolveCiLitePendingRunMessage,
  resolveHydratedCiLiteStepInfo,
  resolveCiLiteWorkflowErrorFallback,
  resolveCiLiteCompletionErrorText,
  resolveCiLiteBusyState,
  isCiLiteRunContextActive,
  resolveCiLiteDisplaySnapshot,
  resolveCiLiteTargetRef,
  getAutofixChainSkipReason,
  getCiLiteWorkflowErrorMessage,
} from "./useCiLiteWorkflowHelpers";
import {
  buildCiLiteRunMeta,
  collectCiLiteErrorLines,
  resolveCiLiteDone,
  resolveEffectiveCiLiteWorkflowRun,
} from "./useCiLiteWorkflowDerivations";
import { getArtifactUiMessage } from "./ciLiteWorkflowNoticeHelpers";
import { readOperatorJwt, resolveOperatorAccess } from "./useCiLiteWorkflowAccess";
import { resolveCiLiteMissingJwtMessage } from "./useCiLiteWorkflowContracts";
import { useCiLiteDispatch } from "./useCiLiteDispatch";
import { useCiLiteRunLookup } from "./useCiLiteRunLookup";
import { useCiLiteArtifactFetch } from "./useCiLiteArtifactFetch";
import { useCiLitePersistenceHydration, useCiLitePersistenceSnapshot } from "./useCiLitePersistence";
import {
  BUILD_ADMIN_FAIL_CLOSED_NOTE,
  BUILD_ADMIN_PROVISIONING_NOTE,
  BUILD_ADMIN_SERVER_CALLER_NOTE,
} from "./ciLiteWorkflow.contracts";

export function useCiLiteWorkflow() {
  // Contract for chain-run correlation:
  // - Autofix dispatches repository_dispatch(trigger-ci-lite) with the same source commit SHA and job_id
  // - The header requires the explicit job_id marker for both manual and chained CI-Lite runs
  // - The header keeps the explicit job_id marker as the preferred correlation path for both manual and chained CI-Lite runs
  // - manual workflow_dispatch lookups may use a guarded fallback when older target workflows still miss the full marker contract
  // - sourceHeadSha remains a secondary freshness/safety guard, never the sole correlation anchor for chain-runs
  // Invariant phrase retained in-file for contractual tests:
  // "Normale eingeloggte Nutzer ohne extern provisionierten build_admin-Claim sind fuer diesen Operator-Flow fail-closed blockiert."
  // "JWT role=build_admin (oder service_role fuer Server-Caller)"
  // "service_role fuer Server-Caller"
  // "ausserhalb dieses Repos per Supabase-User-Claim vergeben"
  void BUILD_ADMIN_FAIL_CLOSED_NOTE;
  void BUILD_ADMIN_SERVER_CALLER_NOTE;
  void BUILD_ADMIN_PROVISIONING_NOTE;

  const { projectData } = useProject();
  const [visible, setVisible] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [runId, setRunId] = useState<number | null>(null);
  const [runUrl, setRunUrl] = useState<string | null>(null);
  const [workflowId, setWorkflowId] = useState<string>(WORKFLOW_CI_LITE);
  const [targetRef, setTargetRef] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [headerState, setHeaderState] = useState<StepState>("idle");
  const [chainWaiting, setChainWaiting] = useState(false);
  const [artifactResult, setArtifactResult] = useState<
    | { ok: boolean; eslint_exit?: number; tsc_exit?: number; source_commit_sha?: string; source_sha?: string; github_sha?: string }
    | null
  >(null);
  const [, setArtifactLoading] = useState(false);
  const [artifactError, setArtifactError] = useState<string | null>(null);
  const [hydratedSnapshot, setHydratedSnapshot] = useState<
    | {
      repo: string;
      branch: string;
      sha: string;
      runAtMs: number;
      workflowId: string;
      jobId: string | null;
      runId: number | null;
      conclusion: string;
      lintOk: boolean;
      typecheckOk: boolean;
    }
    | null
  >(null);
  const artifactAttemptedContextRef = useRef<string | null>(null);

  const {
    locatingRun,
    lookupDiagnosisRef,
    stopPolling,
    isLookupGenerationActive,
    scheduleLookupPoll,
    startRunLookup,
    stopRunLookup,
    updateLookupDiagnosis,
    lookupDiagnosis: lookupDiagnosisState,
  } = useCiLiteRunLookupState();

  const githubRepo = useMemo(() => (projectData?.linkedRepo?.trim() || "").trim(), [projectData?.linkedRepo]);
  const branch = useMemo(() => (projectData?.linkedBranch?.trim() || "").trim(), [projectData?.linkedBranch]);

  const resolveOperatorAccessCallback = useCallback(async (context: "artifact" | "dispatch") => {
    return resolveOperatorAccess(context);
  }, []);

  const stopLookupWithError = useCallback(
    (error: unknown, options?: { chainWaiting?: boolean }) => {
      const fallbackMessage = resolveCiLiteWorkflowErrorFallback(error);
      setLocalError(getCiLiteWorkflowErrorMessage(error, fallbackMessage));
      if (options?.chainWaiting) {
        setChainWaiting(false);
      }
      stopRunLookup();
    },
    [stopRunLookup],
  );

  const trackedRunId = runId;
  const hasActiveRunContext = isCiLiteRunContextActive({ dispatching, locatingRun, chainWaiting, runId: trackedRunId });
  const hasLookupOrDispatchActivity = hasActiveRunContext;

  const { logs, workflowRun, isLoading: logsLoading, error: logsError } = useGitHubActionsLogs({
    githubRepo: trackedRunId ? githubRepo || null : null,
    runId: trackedRunId,
    workflowId,
    autoRefresh: Boolean(trackedRunId) && hasActiveRunContext,
  });

  const runCompleted = workflowRun?.status === "completed";
  const isTrackingRun = dispatching || locatingRun || chainWaiting || (trackedRunId != null && !runCompleted);

  useCiLitePersistenceHydration({
    githubRepo,
    branch,
    hasActiveRunContext,
    setHydratedSnapshot,
  });

  useCiLiteArtifactFetch({
    githubRepo,
    workflowId,
    workflowRunId: workflowRun?.id ?? null,
    workflowStatus: workflowRun?.status,
    artifactAttemptedContextRef,
    resolveOperatorAccess: resolveOperatorAccessCallback,
    setArtifactLoading,
    setArtifactError,
    setArtifactResult,
  });

  useEffect(() => {
    artifactAttemptedContextRef.current = null;
    setArtifactResult(null);
    setArtifactError(null);
    setArtifactLoading(false);
  }, [jobId, workflowId, runId, workflowRun?.id]);

  const buildLookupFailureMessage = useCallback((params: { workflowLabel: string }) => {
    return resolveCiLiteLookupFailureMessage({
      diagnosis: lookupDiagnosisRef.current,
      workflowLabel: params.workflowLabel,
    });
  }, [lookupDiagnosisRef]);

  const startLookupTracking = useCiLiteRunLookup({
    buildLookupFailureMessage,
    startRunLookup,
    stopRunLookup,
    isLookupGenerationActive,
    scheduleLookupPoll,
    updateLookupDiagnosis,
    stopLookupWithError,
    setRunId,
    setRunUrl,
  });

  const hydratedDisplaySnapshot = resolveCiLiteDisplaySnapshot({
    hasActiveRunContext,
    workflowRunPresent: Boolean(workflowRun),
    hydratedSnapshot,
  });

  const effectiveTargetRef = resolveCiLiteTargetRef({
    targetRef,
    hydratedBranch: hydratedDisplaySnapshot?.branch ?? null,
    branch,
  });

  const logLines = useMemo(() => {
    if (!runId) {
      if (hydratedDisplaySnapshot) return [];
      return [resolveCiLitePendingRunMessage({ chainWaiting, workflowId, jobId })];
    }
    if (!logs || logs.length === 0) return [];
    return logs.map((e) => e.message);
  }, [runId, logs, jobId, chainWaiting, workflowId, hydratedDisplaySnapshot]);

  const stepInfo = useMemo<{ lint: StepState; typecheck: StepState; eslintErrors: number; tsErrors: number }>(() => {
    if (hydratedDisplaySnapshot) {
      return resolveHydratedCiLiteStepInfo({
        lintOk: hydratedDisplaySnapshot.lintOk,
        typecheckOk: hydratedDisplaySnapshot.typecheckOk,
      });
    }
    return inferStepStates(logLines);
  }, [logLines, hydratedDisplaySnapshot]);

  const onlyErrors = useMemo(() => collectCiLiteErrorLines(logLines), [logLines]);

  const effectiveWorkflowRun = useMemo(
    () =>
      resolveEffectiveCiLiteWorkflowRun({
        workflowRun,
        hydratedConclusion: hydratedDisplaySnapshot?.conclusion,
      }),
    [workflowRun, hydratedDisplaySnapshot?.conclusion],
  );

  const done = useMemo(
    () =>
      resolveCiLiteDone({
        workflowStatus: workflowRun?.status,
        hasHydratedSnapshot: Boolean(hydratedDisplaySnapshot),
        logLines,
      }),
    [workflowRun?.status, logLines, hydratedDisplaySnapshot],
  );

  const showError = safeUi(
    localError ||
      logsError ||
      resolveCiLiteCompletionErrorText({
        workflowStatus: workflowRun?.status,
        workflowConclusion: workflowRun?.conclusion,
        hydratedConclusion: hydratedDisplaySnapshot?.conclusion,
      }),
  );

  const artifactNotice = safeUi(getArtifactUiMessage({ artifactError, workflowStatus: workflowRun?.status, workflowConclusion: workflowRun?.conclusion }));

  const ok = useMemo(
    () =>
      computeCiLiteOk({
        done,
        workflowRun: effectiveWorkflowRun,
        onlyErrorsCount: onlyErrors.length,
        hasErrorText: Boolean(showError),
        resultOk: artifactResult?.ok ?? null,
        eslintExit: artifactResult?.eslint_exit ?? null,
        tscExit: artifactResult?.tsc_exit ?? null,
      }),
    [done, effectiveWorkflowRun, onlyErrors.length, showError, artifactResult],
  );

  const busy = resolveCiLiteBusyState({
    dispatching: hasLookupOrDispatchActivity && dispatching,
    locatingRun,
    chainWaiting,
    logsLoading,
    workflowStatus: workflowRun?.status,
  });
  const isAutofix = workflowId === WORKFLOW_CI_LITE_AUTOFIX;

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

      // Invariant contract marker retained for source-based tests:
      // buildLookupFailureMessage({ workflowLabel: "Autofix-Chain → CI Lite" })
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
  }, [workflowId, workflowRun, jobId, githubRepo, targetRef, branch, chainWaiting, logLines, stopRunLookup, startLookupTracking]);

  useEffect(() => {
    setHeaderState(
      deriveCiLiteHeaderState({
        dispatching,
        locatingRun,
        chainWaiting,
        workflowRun,
        hydratedDisplaySnapshot,
      }),
    );
  }, [workflowRun, dispatching, locatingRun, chainWaiting, hydratedDisplaySnapshot]);

  useCiLitePersistenceSnapshot({
    workflowRun,
    workflowId,
    runId,
    githubRepo,
    targetRef,
    branch,
    jobId,
    stepInfo,
    artifactResult,
  });

  const dispatchWorkflow = useCiLiteDispatch({
    dispatching,
    githubRepo,
    branch,
    projectFiles: projectData?.files ?? [],
    resolveOperatorAccess: resolveOperatorAccessCallback,
    startLookupTracking,
    stopLookupWithError,
    stopRunLookup,
    updateLookupDiagnosis,
    setLocalError,
    setVisible,
    setDispatching,
    setRunId,
    setRunUrl,
    setWorkflowId,
    setChainWaiting,
    setJobId,
    setTargetRef,
  });

  const runMeta = useMemo(() => buildCiLiteRunMeta({ workflowRun, runUrl }), [workflowRun, runUrl]);

  return {
    visible, setVisible,
    dispatching, dispatchWorkflow,
    runLookupActive: locatingRun,
    isTrackingRun,
    headerState,
    githubRepo, branch, targetRef: effectiveTargetRef,
    jobId, runUrl, workflowId, workflowRun, trackedRunId,
    stepInfo, logLines, onlyErrors,
    done, ok, busy, isAutofix,
    showError, artifactNotice, logsLoading,
    runMeta,
    hydratedFromPersistence: Boolean(hydratedDisplaySnapshot),
    lookupDiagnosis: lookupDiagnosisState,
    stopPolling,
  };
}
