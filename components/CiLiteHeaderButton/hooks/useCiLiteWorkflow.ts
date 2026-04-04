// components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts
// Handles: dispatching workflows, polling for run IDs, chain-runs (autofix → CI Lite).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { v4 as uuidv4 } from "uuid";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { requireSupabaseEdgeUrl } from "../../../lib/supabaseEdge";
import { fetchWithTimeout } from "../../../lib/network/fetchWithTimeout";
import { SUPABASE_EDGE_FUNCTIONS } from "../../../shared/constants/supabase";
import { getBranchHeadSha, getWorkflowAdminKey } from "../../../infra/github/githubService";
import { useProject } from "../../../contexts/ProjectContext";
import { useGitHubActionsLogs } from "../../../hooks/useGitHubActionsLogs";
import { computeCiLiteOk, inferStepStates, safeUi } from "../../ciLite/ciLiteUtils";
import {
  buildPersistCiLiteEntries,
  readPersistedCiLiteSelection,
  type PersistedCiLiteSnapshot,
} from "../../../lib/ciLitePersistence";
import { ensureSupabaseClient } from "../../../lib/supabase";
import { WORKFLOW_CI_LITE, WORKFLOW_CI_LITE_AUTOFIX, type StepState } from "../types";
import { getRepoSyncState } from "../../../lib/repoSyncOrchestration";
import { isLikelyValidAdminKey } from "../../../lib/security/isLikelyValidAdminKey";
import {
  chooseWorkflowRunCandidateDetailed,
  type WorkflowRunLookupDiagnosis,
} from "./workflowRunMatching";
import {
  normalizeCiLiteWorkflowError,
  readCiLiteErrorResponse,
} from "./ciLiteWorkflowErrors";
import { getArtifactUiMessage } from "./ciLiteWorkflowNoticeHelpers";
import {
  buildArtifactFetchContextKey,
  resolveCiLiteArtifactRequest,
  resolveCiLiteLookupFailureMessage,
  parseCiLiteArtifactJson,
  getAutofixChainSkipReason,
  resolveCiLitePendingRunMessage,
  resolveHydratedCiLiteStepInfo,
  getCiLiteWorkflowErrorMessage,
  resolveCiLiteCompletionErrorText,
  resolveCiLiteBusyState,
  splitRepoFullName,
} from "./useCiLiteWorkflowHelpers";
import { deriveCiLiteHeaderState } from "./useCiLiteWorkflowStatusHelpers";
import { useCiLiteRunLookupState } from "./useCiLiteRunLookupState";

export function useCiLiteWorkflow() {
  // Contract for chain-run correlation:
  // - Autofix dispatches repository_dispatch(trigger-ci-lite) with the same source commit SHA and job_id
  // - The header requires the explicit job_id marker for both manual and chained CI-Lite runs
  // - The header keeps the explicit job_id marker as the preferred correlation path for both manual and chained CI-Lite runs
  // - manual workflow_dispatch lookups may use a guarded fallback when older target workflows still miss the full marker contract
  // - sourceHeadSha remains a secondary freshness/safety guard, never the sole correlation anchor for chain-runs
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
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [artifactError, setArtifactError] = useState<string | null>(null);
  const [hydratedSnapshot, setHydratedSnapshot] = useState<PersistedCiLiteSnapshot | null>(null);
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

  // ---- Derived repo/branch ----
  const githubRepo = useMemo(
    () => (projectData?.linkedRepo?.trim() || "").trim(),
    [projectData?.linkedRepo],
  );
  const branch = useMemo(
    () => (projectData?.linkedBranch?.trim() || "").trim(),
    [projectData?.linkedBranch],
  );

  const findMatchingRun = useCallback(
    async (opts: {
      githubRepo: string;
      branch: string;
      jobId: string;
      workflow: string;
      userJwt: string;
      expectedEvent: "repository_dispatch" | "workflow_dispatch";
      startedAtMs: number;
      sourceHeadSha?: string | null;
      requireJobIdMarker?: boolean;
    }) => {
      const {
        githubRepo: repo,
        branch: br,
        workflow,
        userJwt,
        expectedEvent,
        startedAtMs,
        sourceHeadSha,
        requireJobIdMarker = true,
      } = opts;
      const edgeUrl = await requireSupabaseEdgeUrl();
      const workflowAdminKey = await getWorkflowAdminKey().catch(() => null);
      const trimmedWorkflowAdminKey = String(workflowAdminKey ?? "").trim();
      if (!trimmedWorkflowAdminKey || !isLikelyValidAdminKey(trimmedWorkflowAdminKey)) {
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userJwt}`,
          "x-k1w1-admin-key": trimmedWorkflowAdminKey,
        },
        body: JSON.stringify({ githubRepo: repo, workflowId: workflow, ref: br, perPage: 30 }),
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

      return chooseWorkflowRunCandidateDetailed(runs, {
        ...opts,
        expectedEvent,
        startedAtMs,
        sourceHeadSha,
        requireJobIdMarker,
      });
    },
    [],
  );

  // ---- Logs ----
  const trackedRunId = runId;
  const hasActiveRunContext = dispatching || locatingRun || chainWaiting || trackedRunId != null;
  const hasLookupOrDispatchActivity =
    dispatching ||
    locatingRun ||
    chainWaiting ||
    false;

  const {
    logs,
    workflowRun,
    isLoading: logsLoading,
    error: logsError,
  } = useGitHubActionsLogs({
    githubRepo: trackedRunId ? githubRepo || null : null,
    runId: trackedRunId,
    workflowId,
    autoRefresh: Boolean(trackedRunId) && hasActiveRunContext,
  });

  const runCompleted = workflowRun?.status === "completed";
  const isTrackingRun = dispatching || locatingRun || chainWaiting || (trackedRunId != null && !runCompleted);

  useEffect(() => {
    let cancelled = false;

    if (!githubRepo || !branch) {
      setHydratedSnapshot(null);
      return () => {
        cancelled = true;
      };
    }

    if (hasActiveRunContext) {
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const persisted = await readPersistedCiLiteSelection({
        repoFullName: githubRepo,
        branchName: branch,
        deps: {
          storageGetItem: (key: string) => AsyncStorage.getItem(key),
          readBranchHeadSha: getBranchHeadSha,
        },
      });

      if (!cancelled) {
        setHydratedSnapshot(persisted.snapshot);
      }
    })().catch(() => {
      if (!cancelled) setHydratedSnapshot(null);
    });

    return () => {
      cancelled = true;
    };
  }, [githubRepo, branch, hasActiveRunContext]);

  // ---- Artifact result (deterministic header backchannel) ----
  useEffect(() => {
    const artifactRunId = workflowRun?.id ?? null;
    const artifactContextKey = buildArtifactFetchContextKey({
      githubRepo,
      workflowId,
      workflowRunId: artifactRunId,
      workflowStatus: workflowRun?.status ?? null,
    });
    if (!artifactContextKey || !artifactRunId) return;
    if (artifactAttemptedContextRef.current === artifactContextKey) return;

    // Reset any stale errors when a run completes.
    setArtifactError(null);

    artifactAttemptedContextRef.current = artifactContextKey;

    let cancelled = false;

    (async () => {
      try {
        setArtifactLoading(true);

        const edgeUrl = await requireSupabaseEdgeUrl();
        const adminKey = await getWorkflowAdminKey().catch(() => null);
        const trimmedAdminKey = String(adminKey ?? "").trim();
        const supabase = await ensureSupabaseClient().catch(() => null);
        const session = await supabase?.auth.getSession().catch(() => null);
        const userJwt = String(session?.data?.session?.access_token ?? "").trim();
        if (!userJwt) {
          throw new Error("CI-Lite-Artefakt blockiert: Der aktuelle Supabase-Login hat keine Operator-Rolle. Erforderlich ist JWT role=build_admin (oder service_role fuer Server-Caller). build_admin wird im Betriebs-/Provisioning-Prozess ausserhalb dieses Repos per Supabase-User-Claim vergeben. Normale eingeloggte Nutzer ohne extern provisionierten build_admin-Claim sind fuer diesen Operator-Flow fail-closed blockiert.");
        }
        if (!trimmedAdminKey || !isLikelyValidAdminKey(trimmedAdminKey)) {
          const normalized = normalizeCiLiteWorkflowError({
            context: "artifact",
            adminKey,
          });
          throw new Error(normalized.userMessage);
        }

        const { artifactName, filePath } = resolveCiLiteArtifactRequest(workflowId);

        const resp = await fetchWithTimeout(`${edgeUrl}/${SUPABASE_EDGE_FUNCTIONS.GITHUB_RUN_ARTIFACT_JSON}`, {
          timeoutMs: 15_000,
          timeoutMessage: "CI-Lite-Artefakt konnte nicht rechtzeitig geladen werden. Bitte erneut versuchen.",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userJwt}`,
            "x-k1w1-admin-key": trimmedAdminKey,
          },
          body: JSON.stringify({
            githubRepo,
            runId: artifactRunId,
            artifactName,
            filePath,
          }),
        });

        const { payload: data, text: raw } = await readCiLiteErrorResponse(resp);
        if (!resp.ok) {
          const normalized = normalizeCiLiteWorkflowError({
            context: "artifact",
            adminKey: trimmedAdminKey,
            statusCode: resp.status,
            statusText: resp.statusText,
            payload: data,
            text: raw,
          });
          throw new Error(normalized.userMessage);
        }

        const parsed = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
        const inlineJson = parsed.json;
        const jsonCandidate =
          (inlineJson && typeof inlineJson === "object" ? inlineJson : null) ??
          (typeof parsed.text === "string" ? JSON.parse(parsed.text) : null);

        const artifactJson = parseCiLiteArtifactJson(jsonCandidate);

        if (!cancelled) {
          setArtifactResult(artifactJson);
        }
      } catch (e) {
        if (!cancelled) setArtifactError(String(e instanceof Error ? e.message : e));
      } finally {
        if (!cancelled) setArtifactLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    githubRepo,
    workflowId,
    workflowRun?.id,
    workflowRun?.status,
  ]);

  // Clear artifact state when we switch to a new tracked run context.
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
  }, []);

  const hydratedDisplaySnapshot = !hasActiveRunContext && !workflowRun ? hydratedSnapshot : null;
  const effectiveTargetRef = (targetRef || hydratedDisplaySnapshot?.branch || branch || "").trim() || null;

  // ---- Derived log state ----
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

  // If the workflow run exists and completed with a non-success conclusion,
  // always surface that as an error even if log parsing yields nothing.
  const showError = safeUi(
    localError ||
      logsError ||
      resolveCiLiteCompletionErrorText({
        workflowStatus: workflowRun?.status,
        workflowConclusion: workflowRun?.conclusion,
        hydratedConclusion: hydratedDisplaySnapshot?.conclusion,
      }),
  );

  const artifactNotice = safeUi(
    getArtifactUiMessage({
      artifactError,
      workflowStatus: workflowRun?.status,
      workflowConclusion: workflowRun?.conclusion,
    }),
  );

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

  // ---- Chain-run (autofix → CI Lite) ----
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
    const lookupGeneration = startRunLookup();
    setWorkflowId(WORKFLOW_CI_LITE);
    setRunId(null);
    setRunUrl(null);

    void (async () => {
      const supabase = await ensureSupabaseClient().catch(() => null);
      const session = await supabase?.auth.getSession().catch(() => null);
      const userJwt = String(session?.data?.session?.access_token ?? "").trim();
      if (!userJwt) {
        setLocalError("Workflow-Run-Lookup blockiert: Der aktuelle Supabase-Login hat keine Operator-Rolle. Erforderlich ist JWT role=build_admin (oder service_role fuer Server-Caller). build_admin wird im Betriebs-/Provisioning-Prozess ausserhalb dieses Repos per Supabase-User-Claim vergeben. Normale eingeloggte Nutzer ohne extern provisionierten build_admin-Claim sind fuer diesen Operator-Flow fail-closed blockiert.");
        setChainWaiting(false);
        stopRunLookup();
        return;
      }

      const start = Date.now();
      const poll = async () => {
        try {
          const lookup = await findMatchingRun({
            githubRepo,
            branch: b,
            jobId,
            workflow: WORKFLOW_CI_LITE,
            userJwt,
            expectedEvent: "repository_dispatch",
            startedAtMs: start,
            sourceHeadSha: workflowRun.head_sha ?? null,
            requireJobIdMarker: true,
          });
          if (!isLookupGenerationActive(lookupGeneration)) return true;
          updateLookupDiagnosis(lookup.diagnosis);
          if (lookup.candidate?.id) {
            setRunId(Number(lookup.candidate.id));
            setRunUrl(typeof lookup.candidate?.html_url === "string" ? lookup.candidate.html_url : null);
            setChainWaiting(false);
            stopRunLookup();
            return true;
          }
        } catch (e: unknown) {
          setLocalError(getCiLiteWorkflowErrorMessage(e, String(e)));
          setChainWaiting(false);
          stopRunLookup();
          return true;
        }
        if (Date.now() - start > 75_000) {
          setLocalError(buildLookupFailureMessage({ workflowLabel: "Autofix-Chain → CI Lite" }));
          setChainWaiting(false);
          stopRunLookup();
          return true;
        }
        return false;
      };

      const lookupFinished = await poll();
      if (!lookupFinished) {
        scheduleLookupPoll({ generation: lookupGeneration, attempt: 0, poll });
      }
    })();
  }, [workflowId, workflowRun, jobId, githubRepo, targetRef, branch, chainWaiting, logLines, stopRunLookup, startRunLookup, findMatchingRun, buildLookupFailureMessage, updateLookupDiagnosis, scheduleLookupPoll, isLookupGenerationActive]);

  // ---- Header state lamp ----
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

  // ---- Persist CI Lite results ----
  useEffect(() => {
    if (!workflowRun || workflowId !== WORKFLOW_CI_LITE || workflowRun.status !== "completed") return;
    if (runId == null || workflowRun.id !== runId) return;
    if (!githubRepo || !targetRef || targetRef.trim() !== branch.trim()) return;
    const isSuccess = (workflowRun.conclusion || "").toLowerCase() === "success";
    const lintOk = artifactResult ? artifactResult.eslint_exit === 0 : isSuccess || stepInfo.lint === "success";
    const typeOk = artifactResult ? artifactResult.tsc_exit === 0 : isSuccess || stepInfo.typecheck === "success";
    const sourceCommitSha =
      String(
        artifactResult?.source_commit_sha ||
        artifactResult?.source_sha ||
        artifactResult?.github_sha ||
        workflowRun?.head_sha ||
        "",
      ).trim();

    void AsyncStorage.multiSet(
      buildPersistCiLiteEntries({
        // Preferred source of truth is the repo/branch-scoped snapshot.
        // The legacy flat keys are mirrored only temporarily for migration compatibility.
        snapshot: {
          repo: githubRepo,
          branch: (targetRef || branch || "").trim(),
          sha: sourceCommitSha,
          runAtMs: Date.now(),
          workflowId,
          jobId,
          runId: workflowRun?.id ?? null,
          conclusion: String(workflowRun.conclusion || ""),
          lintOk,
          typecheckOk: typeOk,
        },
      }),
    ).catch(() => {});
  }, [
    workflowRun,
    workflowId,
    stepInfo.lint,
    stepInfo.typecheck,
    artifactResult,
    githubRepo,
    targetRef,
    branch,
    jobId,
    runId,
  ]);

  // ---- Dispatch ----
  const dispatchWorkflow = useCallback(
    async (workflowFile: string) => {
      if (dispatching) return;
      const repoParts = splitRepoFullName(githubRepo);
      if (!repoParts) {
        Alert.alert("CI Lite", "Kein gültiges Repo (owner/repo) ausgewählt.");
        return;
      }

      setLocalError(null);
      setVisible(true);
      setDispatching(true);
      setRunId(null);
      setRunUrl(null);
      setWorkflowId(workflowFile);
      setChainWaiting(false);
      updateLookupDiagnosis(null);
      stopRunLookup();

      const newJobId = uuidv4();
      setJobId(newJobId);

      try {
        const targetBranch = branch.trim();
        if (!targetBranch) {
          throw new Error("CI Lite blockiert: Kein Branch verknüpft. Bitte im Repo-Screen einen Branch auswählen.");
        }

        const syncState = await getRepoSyncState({
          linkedRepo: githubRepo,
          linkedBranch: targetBranch,
          files: projectData?.files ?? [],
        });
        if (syncState !== "in_sync") {
          throw new Error(
            syncState === "out_of_sync"
              ? "CI Lite blockiert: Lokale Änderungen sind noch nicht im gewählten Repo/Branch. Bitte zuerst pushen."
              : "CI Lite blockiert: Sync-Status lokal↔Repo ist unklar. Bitte zuerst explizit pushen.",
          );
        }
        setTargetRef(targetBranch);

        const sourceHeadSha = await getBranchHeadSha(
          repoParts.owner,
          repoParts.repo,
          targetBranch,
        ).catch(() => null);

        const workflowAdminKey = await getWorkflowAdminKey().catch(() => null);
        const trimmedWorkflowAdminKey = String(workflowAdminKey ?? "").trim();
        if (!trimmedWorkflowAdminKey || !isLikelyValidAdminKey(trimmedWorkflowAdminKey)) {
          const normalized = normalizeCiLiteWorkflowError({
            context: "dispatch",
            adminKey: workflowAdminKey,
          });
          throw new Error(normalized.userMessage);
        }
        const supabase = await ensureSupabaseClient().catch(() => null);
        const session = await supabase?.auth.getSession().catch(() => null);
        const userJwt = String(session?.data?.session?.access_token ?? "").trim();
        if (!userJwt) {
          throw new Error(
            "Workflow-Dispatch blockiert: Der aktuelle Supabase-Login hat keine Operator-Rolle. Erforderlich ist JWT role=build_admin (oder service_role fuer Server-Caller). build_admin wird im Betriebs-/Provisioning-Prozess ausserhalb dieses Repos per Supabase-User-Claim vergeben. Normale eingeloggte Nutzer ohne extern provisionierten build_admin-Claim sind fuer diesen Operator-Flow fail-closed blockiert.",
          );
        }

        const edgeUrl = await requireSupabaseEdgeUrl();
        const r = await fetchWithTimeout(`${edgeUrl}/${SUPABASE_EDGE_FUNCTIONS.GITHUB_WORKFLOW_DISPATCH}`, {
          timeoutMs: 15_000,
          timeoutMessage: "Workflow-Dispatch hat das Zeitlimit erreicht. Bitte erneut versuchen.",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userJwt}`,
            "x-k1w1-admin-key": trimmedWorkflowAdminKey,
          },
          body: JSON.stringify({
            githubRepo,
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
            adminKey: trimmedWorkflowAdminKey,
            statusCode: r.status,
            statusText: r.statusText,
            payload,
            text,
          });
          throw new Error(normalized.userMessage);
        }

        const start = Date.now();
        const poll = async () => {
          try {
            const lookup = await findMatchingRun({
              githubRepo,
              branch: targetBranch,
              jobId: newJobId,
              workflow: workflowFile,
              userJwt,
              expectedEvent: "workflow_dispatch",
              startedAtMs: start,
              sourceHeadSha,
              requireJobIdMarker: true,
            });
            if (!isLookupGenerationActive(lookupGeneration)) return true;
            updateLookupDiagnosis(lookup.diagnosis);
            if (lookup.candidate?.id) {
              setRunId(Number(lookup.candidate.id));
              setRunUrl(typeof lookup.candidate?.html_url === "string" ? lookup.candidate.html_url : null);
              stopRunLookup();
              return true;
            }
          } catch (e: unknown) {
            setLocalError(getCiLiteWorkflowErrorMessage(e, String(e)));
            stopRunLookup();
            return true;
          }
          if (Date.now() - start > 60_000) {
            setLocalError(buildLookupFailureMessage({ workflowLabel: "Workflow" }));
            stopRunLookup();
            return true;
          }
          return false;
        };

        const lookupGeneration = startRunLookup();
        const lookupFinished = await poll();
        if (!lookupFinished) {
          scheduleLookupPoll({ generation: lookupGeneration, attempt: 0, poll });
        }
      } catch (e: unknown) {
        setLocalError(getCiLiteWorkflowErrorMessage(e, String(e)));
        stopRunLookup();
      } finally {
        setDispatching(false);
      }
    },
    [dispatching, githubRepo, branch, stopRunLookup, startRunLookup, findMatchingRun, projectData?.files, buildLookupFailureMessage, updateLookupDiagnosis, scheduleLookupPoll, isLookupGenerationActive],
  );


  // ---- Run metadata ----
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
