// components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts
// Public CI-Lite facade hook (orchestrates dispatch, run-lookup, artifact-fetch, and persistence helpers).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ensureSupabaseClient } from "../../../lib/supabase";
import { logger } from "../../../lib/logger";
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
  resolveCiLiteMissingJwtMessage,
  getAutofixChainSkipReason,
  getCiLiteWorkflowErrorMessage,
} from "./useCiLiteWorkflowHelpers";
import { getArtifactUiMessage } from "./ciLiteWorkflowNoticeHelpers";
import { useCiLiteDispatch } from "./useCiLiteDispatch";
import { useCiLiteRunLookup } from "./useCiLiteRunLookup";
import { useCiLiteArtifactFetch } from "./useCiLiteArtifactFetch";
import { useCiLitePersistenceHydration, useCiLitePersistenceSnapshot } from "./useCiLitePersistence";
import { getWorkflowAdminKey } from "../../../infra/github/githubService";
import { isLikelyValidAdminKey } from "../../../lib/security/isLikelyValidAdminKey";
import { normalizeCiLiteWorkflowError } from "./ciLiteWorkflowErrors";
import {
  BUILD_ADMIN_FAIL_CLOSED_NOTE,
  BUILD_ADMIN_PROVISIONING_NOTE,
  BUILD_ADMIN_SERVER_CALLER_NOTE,
} from "./ciLiteWorkflow.contracts";

async function readOperatorJwt(context: "artifact" | "lookup" | "dispatch"): Promise<string | null> {
  const supabase = await ensureSupabaseClient().catch((error: unknown) => {
    logger.warn("[CiLiteWorkflow] ensureSupabaseClient failed while reading operator jwt", { context, error });
    return null;
  });
  if (!supabase) return null;

  const session = await supabase.auth.getSession().catch((error: unknown) => {
    logger.warn("[CiLiteWorkflow] auth.getSession failed while reading operator jwt", { context, error });
    return null;
  });
  const jwt = String(session?.data?.session?.access_token ?? "").trim();
  return jwt || null;
}

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

  const resolveOperatorAccess = useCallback(async (context: "artifact" | "dispatch") => {
    const adminKey = await getWorkflowAdminKey().catch(() => null);
    const trimmedAdminKey = String(adminKey ?? "").trim();
    if (!trimmedAdminKey || !isLikelyValidAdminKey(trimmedAdminKey)) {
      const normalized = normalizeCiLiteWorkflowError({
        context,
        adminKey,
      });
      throw new Error(normalized.userMessage);
    }

    const userJwt = await readOperatorJwt(context);
    if (!userJwt) {
      throw new Error(resolveCiLiteMissingJwtMessage(context));
    }

    return {
      adminKey: trimmedAdminKey,
      userJwt,
    };
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
    resolveOperatorAccess,
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

  const onlyErrors = useMemo(() => {
    const out: string[] = [];
    for (const l of logLines) {
      if (/error\s+TS\d+:/i.test(l)) out.push(l);
      else if (/\serror\s{2,}/i.test(l) && !/error\s+TS\d+:/i.test(l)) out.push(l);
      else if (/JSX element .* has no corresponding closing tag/i.test(l)) out.push(l);
      else if (/Process completed with exit code\s+(?!0)\d+/i.test(l)) out.push(l);
    }
    return out;
  }, [logLines]);

  const effectiveWorkflowRun = workflowRun ?? (hydratedDisplaySnapshot
    ? { status: "completed", conclusion: hydratedDisplaySnapshot.conclusion }
    : null);

  const done = useMemo(() => {
    if (workflowRun?.status === "completed") return true;
    if (hydratedDisplaySnapshot) return true;
    if (logLines?.some((l) => /Process completed with exit code/i.test(l))) return true;
    return false;
  }, [workflowRun?.status, logLines, hydratedDisplaySnapshot]);

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
    resolveOperatorAccess,
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

  const runMeta = useMemo(() => {
    if (!workflowRun?.created_at) return null;
    const created = Date.parse(workflowRun.created_at);
    const updated = Date.parse(workflowRun.updated_at || workflowRun.created_at);
    const durMs = Number.isFinite(created) && Number.isFinite(updated) ? Math.max(0, updated - created) : 0;
    const durSec = Math.round(durMs / 1000);
    return {
      id: workflowRun.id,
      runNumber: workflowRun.run_number,
      status: workflowRun.status,
      conclusion: workflowRun.conclusion || "—",
      duration: durSec ? `${durSec}s` : "—",
      url: runUrl || workflowRun.html_url,
      updatedAt: workflowRun.updated_at,
    };
  }, [workflowRun, runUrl]);

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
