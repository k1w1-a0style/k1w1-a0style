// components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts
// Handles: dispatching workflows, polling for run IDs, chain-runs (autofix → CI Lite).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { v4 as uuidv4 } from "uuid";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { requireSupabaseEdgeUrl } from "../../../lib/supabaseEdge";
import { SUPABASE_EDGE_FUNCTIONS } from "../../../shared/constants/supabase";
import { getBranchHeadSha, getEdgeAdminKey } from "../../../infra/github/githubService";
import { useProject } from "../../../contexts/ProjectContext";
import { useGitHubActionsLogs } from "../../../hooks/useGitHubActionsLogs";
import { computeCiLiteOk, inferStepStates, safeUi } from "../../ciLite/ciLiteUtils";
import { readPersistedCiLiteSelection, type PersistedCiLiteSnapshot } from "../../../lib/ciLitePersistence";
import { STORAGE_KEYS } from "../../../lib/storageKeys";
import { WORKFLOW_CI_LITE, WORKFLOW_CI_LITE_AUTOFIX, type StepState } from "../types";
import { getRepoSyncState } from "../../../lib/repoSyncOrchestration";
import { describeLocalEdgeAdminKeyIssue } from "../../../screens/CredentialsWizardScreen/utils/localAdminKey";
import { isLikelyValidAdminKey } from "../../../screens/CredentialsWizardScreen/utils/security";
import { chooseWorkflowRunCandidate } from "./workflowRunMatching";


type CiLiteArtifactJson = {
  ok: boolean;
  eslint_exit?: number;
  tsc_exit?: number;
  source_commit_sha?: string;
  source_sha?: string;
  github_sha?: string;
};

function parseCiLiteArtifactJson(payload: unknown): CiLiteArtifactJson {
  if (!payload || typeof payload !== "object") {
    throw new Error("Artifact JSON missing or invalid");
  }

  const src = payload as Record<string, unknown>;
  const readNum = (k: "eslint_exit" | "tsc_exit"): number | undefined =>
    typeof src[k] === "number" ? src[k] : undefined;
  const readSha = (k: "source_commit_sha" | "source_sha" | "github_sha"): string | undefined =>
    typeof src[k] === "string" ? (src[k] as string).trim() || undefined : undefined;

  return {
    ok: typeof src.ok === "boolean" ? src.ok : Boolean(src.ok),
    eslint_exit: readNum("eslint_exit"),
    tsc_exit: readNum("tsc_exit"),
    source_commit_sha: readSha("source_commit_sha"),
    source_sha: readSha("source_sha"),
    github_sha: readSha("github_sha"),
  };
}


function getAutofixChainSkipReason(lines: string[]): string | null {
  if (!Array.isArray(lines) || lines.length === 0) return null;
  const joined = lines.join("\n");

  if (/No\s+TARGET_BRANCH.*skipping\s+CI\s*Lite\s+chain-?run/i.test(joined)) {
    return "Kein TARGET_BRANCH im Autofix-Run";
  }
  if (/Ref\s+looks\s+like\s+a\s+SHA.*skipping\s+CI\s*Lite\s+chain-?run/i.test(joined)) {
    return "Ref wurde als SHA statt Branch erkannt";
  }
  if (/Unsafe\s+ref.*skipping\s+CI\s*Lite\s+chain-?run/i.test(joined)) {
    return "Ref enthält unsichere Zeichen";
  }
  if (/CI\s*Lite\s+chain-?run\s+disabled\s+for.*regex:/i.test(joined)) {
    return "Ref ist laut Workflow-Regeln nicht für Chain-Run erlaubt";
  }
  if (/is\s+not\s+a\s+remote\s+branch.*skipping\s+CI\s*Lite\s+chain-?run/i.test(joined)) {
    return "Ref existiert nicht als Remote-Branch";
  }

  return null;
}




type WorkflowRunLocatorCandidate = {
  id?: unknown;
  html_url?: unknown;
  display_title?: unknown;
  name?: unknown;
  created_at?: unknown;
  event?: unknown;
  head_branch?: unknown;
  head_sha?: unknown;
} | null | undefined;

function getArtifactUiMessage(params: {
  artifactError: string | null;
  workflowStatus?: string | null;
  workflowConclusion?: string | null;
}): string {
  if (!params.artifactError) return "";

  const status = String(params.workflowStatus ?? "").trim().toLowerCase();
  const conclusion = String(params.workflowConclusion ?? "").trim().toLowerCase();
  if (status === "completed" && conclusion === "success") {
    return "Workflow war erfolgreich, aber das Ergebnis-Artefakt konnte nicht geladen werden. Bitte Run öffnen oder erneut starten.";
  }

  return "Zusätzliche Ergebnisdaten zum Run konnten nicht geladen werden. Bitte Run öffnen oder erneut starten.";
}

function buildCiLiteAdminKeyError(params: {
  adminKey?: string | null;
  statusCode?: number | null;
  error?: unknown;
  context: "dispatch" | "artifact";
}): string | null {
  const reason = describeLocalEdgeAdminKeyIssue({
    adminKey: params.adminKey,
    statusCode: params.statusCode,
    error: params.error,
  });
  if (!reason) return null;

  if (params.context === "artifact") {
    return `CI Lite Ergebnisabruf blockiert: ${reason}`;
  }
  return `CI Lite Dispatch blockiert: ${reason}`;
}

export function useCiLiteWorkflow() {
  // Contract for chain-run correlation:
  // - Autofix dispatches repository_dispatch(trigger-ci-lite) with the same source commit SHA and job_id
  // - The header requires the explicit job_id marker for both manual and chained CI-Lite runs
  // - sourceHeadSha remains a secondary freshness/safety guard, never the sole correlation anchor
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

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Derived repo/branch ----
  const githubRepo = useMemo(
    () => (projectData?.linkedRepo?.trim() || "").trim(),
    [projectData?.linkedRepo],
  );
  const branch = useMemo(
    () => (projectData?.linkedBranch?.trim() || "").trim(),
    [projectData?.linkedBranch],
  );

  // ---- Polling helpers ----
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const findMatchingRun = useCallback(
    async (opts: {
      githubRepo: string;
      branch: string;
      jobId: string;
      workflow: string;
      expectedEvent: "repository_dispatch" | "workflow_dispatch";
      startedAtMs: number;
      sourceHeadSha?: string | null;
      requireJobIdMarker?: boolean;
    }) => {
      const {
        githubRepo: repo,
        branch: br,
        workflow,
        expectedEvent,
        startedAtMs,
        sourceHeadSha,
        requireJobIdMarker = true,
      } = opts;
      const edgeUrl = await requireSupabaseEdgeUrl();
      const edgeAdminKey = await getEdgeAdminKey().catch(() => null);

      const r = await fetch(`${edgeUrl}/${SUPABASE_EDGE_FUNCTIONS.GITHUB_WORKFLOW_RUNS}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(edgeAdminKey ? { "x-k1w1-admin-key": edgeAdminKey } : {}),
        },
        body: JSON.stringify({ githubRepo: repo, workflowId: workflow, ref: br, perPage: 30 }),
      });

      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(`github-workflow-runs failed (${r.status}): ${safeUi(t || r.statusText)}`);
      }

      const json = await r.json();
      const workflowLookupNote = typeof json?.note === "string" ? json.note.trim() : "";
      if (workflowLookupNote) {
        throw new Error(
          `Workflow-Run-Lookup ist nicht workflow-spezifisch abgesichert (${safeUi(workflowLookupNote)}).`,
        );
      }

      const runs = json?.data?.workflow_runs ?? json?.workflow_runs ?? json?.runs ?? [];
      if (!Array.isArray(runs)) return null;

      return chooseWorkflowRunCandidate(runs, {
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
  const hasActiveRunContext = dispatching || chainWaiting || trackedRunId != null;

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
  const isTrackingRun = dispatching || chainWaiting || (trackedRunId != null && !runCompleted);

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
    if (!githubRepo) return;
    if (!workflowRun?.id) return;
    if (workflowRun.status !== "completed") return;

    // Reset any stale errors when a run completes.
    setArtifactError(null);

    // Avoid refetch loops
    if (artifactLoading) return;
    if (artifactResult) return;

    let cancelled = false;

    (async () => {
      try {
        setArtifactLoading(true);

        const edgeUrl = await requireSupabaseEdgeUrl();
        const adminKey = await getEdgeAdminKey().catch(() => null);
        const trimmedAdminKey = String(adminKey ?? "").trim();
        if (!trimmedAdminKey || !isLikelyValidAdminKey(trimmedAdminKey)) {
          throw new Error(
            buildCiLiteAdminKeyError({
              adminKey,
              context: "artifact",
            }) ?? "CI Lite Ergebnisabruf blockiert: lokaler Edge Admin Key fehlt oder ist ungueltig.",
          );
        }

        const artifactName =
          workflowId === WORKFLOW_CI_LITE_AUTOFIX ? "ci-lite-autofix-logs" : "ci-lite-logs";
        const filePath =
          workflowId === WORKFLOW_CI_LITE_AUTOFIX
            ? "ci-logs/ci-lite-autofix-result.json"
            : "ci-logs/ci-lite-result.json";

        const resp = await fetch(`${edgeUrl}/${SUPABASE_EDGE_FUNCTIONS.GITHUB_RUN_ARTIFACT_JSON}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-k1w1-admin-key": trimmedAdminKey,
          },
          body: JSON.stringify({
            githubRepo,
            runId: workflowRun.id,
            artifactName,
            filePath,
          }),
        });

        const data: unknown = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          const errObj = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
          const msg = typeof errObj?.error === "string" ? errObj.error : `HTTP ${resp.status}`;
          throw new Error(
            buildCiLiteAdminKeyError({
              adminKey: trimmedAdminKey,
              statusCode: resp.status,
              error: msg,
              context: "artifact",
            }) ?? msg,
          );
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
    artifactLoading,
    artifactResult,
  ]);

  // Clear artifact state when we switch to a new tracked run context.
  useEffect(() => {
    setArtifactResult(null);
    setArtifactError(null);
    setArtifactLoading(false);
  }, [jobId, workflowId, runId]);

  const hydratedDisplaySnapshot = !hasActiveRunContext && !workflowRun ? hydratedSnapshot : null;
  const effectiveTargetRef = (targetRef || hydratedDisplaySnapshot?.branch || branch || "").trim() || null;

  // ---- Derived log state ----
  const logLines = useMemo(() => {
    if (!runId) {
      if (hydratedDisplaySnapshot) return [];
      return [
        chainWaiting && workflowId === WORKFLOW_CI_LITE
          ? `Autofix fertig – starte CI Lite (chain-run)… (job_id: ${jobId || ""})`
          : jobId
            ? `Warte auf GitHub Run… (job_id: ${jobId})`
            : "Warte auf GitHub Run…",
      ];
    }
    if (!logs || logs.length === 0) return [];
    return logs.map((e) => e.message);
  }, [runId, logs, jobId, chainWaiting, workflowId, hydratedDisplaySnapshot]);

  const stepInfo = useMemo<{ lint: StepState; typecheck: StepState; eslintErrors: number; tsErrors: number }>(() => {
    if (hydratedDisplaySnapshot) {
      return {
        lint: hydratedDisplaySnapshot.lintOk ? "success" : "failure",
        typecheck: hydratedDisplaySnapshot.typecheckOk ? "success" : "failure",
        eslintErrors: hydratedDisplaySnapshot.lintOk ? 0 : 1,
        tsErrors: hydratedDisplaySnapshot.typecheckOk ? 0 : 1,
      };
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
      (workflowRun?.status === "completed" &&
      workflowRun.conclusion &&
      workflowRun.conclusion !== "success"
        ? `Workflow failed (${workflowRun.conclusion}). Open the run for details.`
        : hydratedDisplaySnapshot && hydratedDisplaySnapshot.conclusion !== "success"
          ? `Letzter CI-Lite-Run ist beendet, aber nicht grün (${hydratedDisplaySnapshot.conclusion}).`
          : ""),
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

  const busy =
    dispatching ||
    chainWaiting ||
    logsLoading ||
    workflowRun?.status === "in_progress" ||
    workflowRun?.status === "queued";
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
      stopPolling();
      return;
    }

    setChainWaiting(true);
    setWorkflowId(WORKFLOW_CI_LITE);
    setRunId(null);
    setRunUrl(null);
    stopPolling();

    const start = Date.now();
    const poll = async () => {
      try {
        const found = await findMatchingRun({
          githubRepo,
          branch: b,
          jobId,
          workflow: WORKFLOW_CI_LITE,
          expectedEvent: "repository_dispatch",
          startedAtMs: start,
          sourceHeadSha: workflowRun.head_sha ?? null,
          requireJobIdMarker: true,
        });
        if (found?.id) {
          setRunId(Number(found.id));
          setRunUrl(typeof found?.html_url === "string" ? found.html_url : null);
          setChainWaiting(false);
          stopPolling();
          return;
        }
      } catch (e: any) {
        setLocalError(e?.message || String(e));
      }
      if (Date.now() - start > 75_000) {
        setLocalError(
          "Autofix-Chain ausgelöst, aber kein frischer passender CI-Lite-Run gefunden (Timeout). Prüfe job_id-Contract/Workflow-Dispatch.",
        );
        setChainWaiting(false);
        stopPolling();
      }
    };

    void poll();
    pollTimerRef.current = setInterval(poll, 2500);
  }, [workflowId, workflowRun, jobId, githubRepo, targetRef, branch, chainWaiting, logLines, stopPolling, findMatchingRun]);

  // ---- Header state lamp ----
  useEffect(() => {
    if (dispatching || chainWaiting) { setHeaderState("running"); return; }
    if (workflowRun?.status) {
      if (workflowRun.status !== "completed") { setHeaderState("running"); return; }
      if (workflowRun.conclusion === "success") setHeaderState("success");
      else if (workflowRun.conclusion === "failure" || workflowRun.conclusion === "cancelled") setHeaderState("failure");
      else setHeaderState("idle");
      return;
    }
    if (hydratedDisplaySnapshot) {
      setHeaderState(hydratedDisplaySnapshot.conclusion === "success" ? "success" : "failure");
      return;
    }
    setHeaderState("idle");
  }, [workflowRun?.status, workflowRun?.conclusion, dispatching, chainWaiting, hydratedDisplaySnapshot]);

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

    void AsyncStorage.multiSet([
      [STORAGE_KEYS.CI_LITE_LINT_OK, lintOk ? "true" : "false"],
      [STORAGE_KEYS.CI_LITE_TYPECHECK_OK, typeOk ? "true" : "false"],
      [STORAGE_KEYS.CI_LITE_LAST_RUN_AT, String(Date.now())],
      [STORAGE_KEYS.CI_LITE_LAST_REPO, githubRepo || ""],
      [STORAGE_KEYS.CI_LITE_LAST_BRANCH, (targetRef || branch || "").trim()],
      [STORAGE_KEYS.CI_LITE_LAST_SHA, sourceCommitSha],
      [STORAGE_KEYS.CI_LITE_LAST_WORKFLOW, workflowId],
      [STORAGE_KEYS.CI_LITE_LAST_JOB_ID, jobId || ""],
      [STORAGE_KEYS.CI_LITE_LAST_RUN_ID, workflowRun?.id != null ? String(workflowRun.id) : ""],
      [STORAGE_KEYS.CI_LITE_LAST_CONCLUSION, String(workflowRun.conclusion || "")],
    ]).catch(() => {});
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
      if (!githubRepo || !githubRepo.includes("/")) {
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
      stopPolling();

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

        const edgeAdminKey = await getEdgeAdminKey().catch(() => null);
        const trimmedEdgeAdminKey = String(edgeAdminKey ?? "").trim();
        if (!trimmedEdgeAdminKey || !isLikelyValidAdminKey(trimmedEdgeAdminKey)) {
          throw new Error(
            buildCiLiteAdminKeyError({
              adminKey: edgeAdminKey,
              context: "dispatch",
            }) ?? "CI Lite Dispatch blockiert: lokaler Edge Admin Key fehlt oder ist ungueltig.",
          );
        }

        const edgeUrl = await requireSupabaseEdgeUrl();
        const r = await fetch(`${edgeUrl}/${SUPABASE_EDGE_FUNCTIONS.GITHUB_WORKFLOW_DISPATCH}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-k1w1-admin-key": trimmedEdgeAdminKey },
          body: JSON.stringify({
            githubRepo,
            workflow: workflowFile,
            ref: targetBranch,
            // `ref` is already provided as the top-level workflow_dispatch ref.
            // `inputs` must match the workflow's declared `workflow_dispatch.inputs`.
            inputs: { job_id: newJobId },
          }),
        });

        if (!r.ok) {
          const t = await r.text().catch(() => "");
          const safeText = safeUi(t || r.statusText);
          const adminKeyError = buildCiLiteAdminKeyError({
            adminKey: trimmedEdgeAdminKey,
            statusCode: r.status,
            error: safeText,
            context: "dispatch",
          });
          if (adminKeyError) {
            throw new Error(adminKeyError);
          }
          const hint = r.status === 404 ? " (Workflow-Datei auf diesem Branch nicht gefunden)" : "";
          throw new Error(`github-workflow-dispatch failed (${r.status}): ${safeText}${hint}`);
        }

        const start = Date.now();
        const poll = async () => {
          try {
            const found = await findMatchingRun({
              githubRepo,
              branch: targetBranch,
              jobId: newJobId,
              workflow: workflowFile,
              expectedEvent: "workflow_dispatch",
              startedAtMs: start,
            });
            if (found?.id) {
              setRunId(Number(found.id));
              setRunUrl(typeof found?.html_url === "string" ? found.html_url : null);
              stopPolling();
              return;
            }
          } catch (e: any) {
            setLocalError(e?.message || String(e));
          }
          if (Date.now() - start > 60_000) {
            setLocalError("Workflow wurde gestartet, aber kein passender Run gefunden (Timeout). Bitte Run-Übersicht öffnen.");
            stopPolling();
          }
        };

        await poll();
        pollTimerRef.current = setInterval(poll, 2500);
      } catch (e: any) {
        setLocalError(e?.message || String(e));
      } finally {
        setDispatching(false);
      }
    },
    [dispatching, githubRepo, branch, stopPolling, findMatchingRun, projectData?.files],
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
    isTrackingRun,
    headerState,
    githubRepo, branch, targetRef: effectiveTargetRef,
    jobId, runUrl, workflowId, workflowRun, trackedRunId,
    stepInfo, logLines, onlyErrors,
    done, ok, busy, isAutofix,
    showError, artifactNotice, logsLoading,
    runMeta,
    hydratedFromPersistence: Boolean(hydratedDisplaySnapshot),
    stopPolling,
  };
}
