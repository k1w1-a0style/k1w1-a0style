// components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts
// Handles: dispatching workflows, polling for run IDs, chain-runs (autofix → CI Lite).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { v4 as uuidv4 } from "uuid";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getGitHubToken } from "../../../infra/github/tokenStore";
import { requireSupabaseEdgeUrl } from "../../../lib/supabaseEdge";
import { SUPABASE_EDGE_FUNCTIONS } from "../../../shared/constants/supabase";
import { getDefaultBranch, getEdgeAdminKey } from "../../../infra/github/githubService";
import { useProject } from "../../../contexts/ProjectContext";
import { useGitHubActionsLogs } from "../../../hooks/useGitHubActionsLogs";
import { computeCiLiteOk, inferStepStates, safeUi } from "../../ciLite/ciLiteUtils";
import { STORAGE_KEYS } from "../../../lib/storageKeys";
import { WORKFLOW_CI_LITE, WORKFLOW_CI_LITE_AUTOFIX, type StepState } from "../types";

export function useCiLiteWorkflow() {
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
    | { ok: boolean; eslint_exit?: number; tsc_exit?: number }
    | null
  >(null);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [artifactError, setArtifactError] = useState<string | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const manualCiLiteSessionRef = useRef<string | null>(null);
  const autoAutofixStartedForSessionRef = useRef<string | null>(null);

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

  const findRunByJobId = useCallback(
    async (opts: { githubRepo: string; branch: string; jobId: string; workflow: string }) => {
      const { githubRepo: repo, branch: br, jobId: jid, workflow } = opts;
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
      const runs = json?.data?.workflow_runs ?? json?.workflow_runs ?? json?.runs ?? [];
      if (!Array.isArray(runs)) return null;

      return runs.find((x: any) => String(x?.display_title ?? x?.name ?? "").includes(jid)) ?? null;
    },
    [],
  );

  // ---- Logs ----
  const {
    logs,
    workflowRun,
    isLoading: logsLoading,
    error: logsError,
  } = useGitHubActionsLogs({
    githubRepo: visible ? githubRepo || null : null,
    runId,
    workflowId,
    autoRefresh: visible,
  });


  // ---- Artifact result (deterministic header backchannel) ----
  useEffect(() => {
    if (!visible) return;
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
        const adminKey = await getEdgeAdminKey();
        if (!adminKey) {
          throw new Error(
            "Missing SIGNING_ADMIN_KEY for CI-Lite (x-k1w1-admin-key). Configure it in app secrets/env.",
          );
        }

        const artifactName =
          workflowId === WORKFLOW_CI_LITE_AUTOFIX ? "ci-lite-autofix-logs" : "ci-lite-logs";
        const filePath =
          workflowId === WORKFLOW_CI_LITE_AUTOFIX
            ? "ci-logs/ci-lite-autofix-result.json"
            : "ci-logs/ci-lite-result.json";

        const resp = await fetch(`${edgeUrl}/github-run-artifact-json`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-k1w1-admin-key": adminKey,
          },
          body: JSON.stringify({
            githubRepo,
            runId: workflowRun.id,
            artifactName,
            filePath,
          }),
        });

        const data = await resp.json().catch(() => ({} as any));
        if (!resp.ok) {
          const msg = data?.error ? String(data.error) : `HTTP ${resp.status}`;
          throw new Error(msg);
        }

        const json =
          (data?.json && typeof data.json === "object" ? data.json : null) ??
          (typeof data?.text === "string" ? JSON.parse(data.text) : null);

        if (!json || typeof json !== "object") {
          throw new Error("Artifact JSON missing or invalid");
        }

        const ok = Boolean((json as any).ok);
        const eslint_exit =
          typeof (json as any).eslint_exit === "number" ? (json as any).eslint_exit : undefined;
        const tsc_exit =
          typeof (json as any).tsc_exit === "number" ? (json as any).tsc_exit : undefined;

        if (!cancelled) setArtifactResult({ ok, eslint_exit, tsc_exit });
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
    visible,
    githubRepo,
    workflowId,
    workflowRun?.id,
    workflowRun?.status,
    artifactLoading,
    artifactResult,
  ]);

  // Clear artifact state when we start a new run or hide UI.
  useEffect(() => {
    setArtifactResult(null);
    setArtifactError(null);
    setArtifactLoading(false);
  }, [visible, jobId, workflowId, runId]);

  // ---- Derived log state ----
  const logLines = useMemo(() => {
    if (!visible) return [];
    if (!runId) {
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
  }, [visible, runId, logs, jobId, chainWaiting, workflowId]);

  const stepInfo = useMemo(() => inferStepStates(logLines), [logLines]);

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

  const done = useMemo(() => {
    if (workflowRun?.status === "completed") return true;
    if (logLines?.some((l) => /Process completed with exit code/i.test(l))) return true;
    return false;
  }, [workflowRun?.status, logLines]);

  // If the workflow run exists and completed with a non-success conclusion,
  // always surface that as an error even if log parsing yields nothing.
  const showError = safeUi(
    localError ||
      logsError ||
      (workflowRun?.status === "completed" &&
      workflowRun.conclusion &&
      workflowRun.conclusion !== "success"
        ? `Workflow failed (${workflowRun.conclusion}). Open the run for details.`
        : ""),
  );

  const ok = useMemo(
    () =>
      computeCiLiteOk({
        done,
        workflowRun,
        onlyErrorsCount: onlyErrors.length,
        hasErrorText: Boolean(showError),
        resultOk: artifactResult?.ok ?? null,
        eslintExit: artifactResult?.eslint_exit ?? null,
        tscExit: artifactResult?.tsc_exit ?? null,
      }),
    [done, workflowRun, onlyErrors.length, showError, artifactResult],
  );

  const busy = dispatching || logsLoading || workflowRun?.status === "in_progress";
  const isAutofix = workflowId === WORKFLOW_CI_LITE_AUTOFIX;

  // ---- Chain-run (autofix → CI Lite) ----
  useEffect(() => {
    if (!visible || workflowId !== WORKFLOW_CI_LITE_AUTOFIX || !workflowRun) return;
    if (workflowRun.status !== "completed" || workflowRun.conclusion !== "success") return;
    if (!jobId || !githubRepo || chainWaiting) return;

    const b = (targetRef || branch || "").trim();
    if (!b) return;

    setChainWaiting(true);
    setWorkflowId(WORKFLOW_CI_LITE);
    setRunId(null);
    setRunUrl(null);
    stopPolling();

    const start = Date.now();
    const poll = async () => {
      try {
        const found = await findRunByJobId({ githubRepo, branch: b, jobId, workflow: WORKFLOW_CI_LITE });
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
        setChainWaiting(false);
        stopPolling();
      }
    };

    void poll();
    pollTimerRef.current = setInterval(poll, 2500);
  }, [visible, workflowId, workflowRun, jobId, githubRepo, targetRef, branch, chainWaiting, stopPolling, findRunByJobId]);

  // ---- Header state lamp ----
  useEffect(() => {
    if (dispatching) { setHeaderState("running"); return; }
    if (!workflowRun?.status) return;
    if (workflowRun.status !== "completed") { setHeaderState("running"); return; }
    if (workflowRun.conclusion === "success") setHeaderState("success");
    else if (workflowRun.conclusion === "failure" || workflowRun.conclusion === "cancelled") setHeaderState("failure");
  }, [workflowRun?.status, workflowRun?.conclusion, dispatching]);

  // ---- Persist CI Lite results ----
  useEffect(() => {
    if (!workflowRun || workflowId !== WORKFLOW_CI_LITE || workflowRun.status !== "completed") return;
    const isSuccess = (workflowRun.conclusion || "").toLowerCase() === "success";
    const lintOk = artifactResult ? artifactResult.eslint_exit === 0 : isSuccess || stepInfo.lint === "success";
    const typeOk = artifactResult ? artifactResult.tsc_exit === 0 : isSuccess || stepInfo.typecheck === "success";
    void AsyncStorage.multiSet([
      [STORAGE_KEYS.CI_LITE_LINT_OK, lintOk ? "true" : "false"],
      [STORAGE_KEYS.CI_LITE_TYPECHECK_OK, typeOk ? "true" : "false"],
      [STORAGE_KEYS.CI_LITE_LAST_RUN_AT, String(Date.now())],
      [STORAGE_KEYS.CI_LITE_LAST_REPO, githubRepo || ""],
      [STORAGE_KEYS.CI_LITE_LAST_BRANCH, (targetRef || branch || "").trim()],
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
  ]);

  // ---- Dispatch ----
  const dispatchWorkflow = useCallback(
    async (workflowFile: string) => {
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
      if (workflowFile === WORKFLOW_CI_LITE) {
        manualCiLiteSessionRef.current = newJobId;
        autoAutofixStartedForSessionRef.current = null;
      }
      setJobId(newJobId);

      try {
        const [owner, repo] = githubRepo.split("/");
        let targetBranch = branch;
        if (!targetBranch) {
          try { targetBranch = (await getDefaultBranch(owner, repo)).trim(); } catch { targetBranch = "main"; }
        }
        if (!targetBranch) targetBranch = "main";
        setTargetRef(targetBranch);

        const edgeAdminKey = await getEdgeAdminKey().catch(() => null);
        if (!edgeAdminKey) {
          throw new Error("Edge Admin Key fehlt. Bitte im Verbindungen/Credentials Wizard setzen.");
        }

        const edgeUrl = await requireSupabaseEdgeUrl();
        const r = await fetch(`${edgeUrl}/${SUPABASE_EDGE_FUNCTIONS.GITHUB_WORKFLOW_DISPATCH}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-k1w1-admin-key": edgeAdminKey },
          body: JSON.stringify({
            githubRepo,
            githubToken: await getGitHubToken().catch(() => null),
            workflow: workflowFile,
            ref: targetBranch,
            // `ref` is already provided as the top-level workflow_dispatch ref.
            // `inputs` must match the workflow's declared `workflow_dispatch.inputs`.
            inputs: { job_id: newJobId },
          }),
        });

        if (!r.ok) {
          const t = await r.text().catch(() => "");
          const hint =
            r.status === 404 ? " (Workflow-Datei auf diesem Branch nicht gefunden)"
            : r.status === 401 || r.status === 403 ? " (Admin-Key falsch/fehlt)"
            : "";
          throw new Error(`github-workflow-dispatch failed (${r.status}): ${safeUi(t || r.statusText)}${hint}`);
        }

        const start = Date.now();
        const poll = async () => {
          try {
            const found = await findRunByJobId({ githubRepo, branch: targetBranch, jobId: newJobId, workflow: workflowFile });
            if (found?.id) {
              setRunId(Number(found.id));
              setRunUrl(typeof found?.html_url === "string" ? found.html_url : null);
              stopPolling();
              return;
            }
          } catch (e: any) {
            setLocalError(e?.message || String(e));
          }
          if (Date.now() - start > 60_000) stopPolling();
        };

        await poll();
        pollTimerRef.current = setInterval(poll, 2500);
      } catch (e: any) {
        setLocalError(e?.message || String(e));
      } finally {
        setDispatching(false);
      }
    },
    [githubRepo, branch, stopPolling, findRunByJobId],
  );


  // ---- Auto chain (manual CI Lite failure -> Autofix once) ----
  useEffect(() => {
    if (!visible || workflowId !== WORKFLOW_CI_LITE || !workflowRun) return;
    if (workflowRun.status !== "completed") return;

    const conclusion = String(workflowRun.conclusion || "").toLowerCase();
    if (conclusion !== "failure") return;

    const manualSessionId = manualCiLiteSessionRef.current;
    if (!manualSessionId || jobId !== manualSessionId) return;
    if (autoAutofixStartedForSessionRef.current === manualSessionId) return;
    if (!githubRepo || !branch) return;

    autoAutofixStartedForSessionRef.current = manualSessionId;
    void dispatchWorkflow(WORKFLOW_CI_LITE_AUTOFIX);
  }, [visible, workflowId, workflowRun, jobId, githubRepo, branch, dispatchWorkflow]);

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
    headerState,
    githubRepo, branch, targetRef,
    jobId, runUrl, workflowId, workflowRun,
    stepInfo, logLines, onlyErrors,
    done, ok, busy, isAutofix,
    showError, logsLoading,
    runMeta,
    stopPolling,
  };
}
