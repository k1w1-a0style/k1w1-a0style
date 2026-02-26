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
import { useGitHub } from "../../../contexts/GitHubContext";
import { useProject } from "../../../contexts/ProjectContext";
import { useGitHubActionsLogs } from "../../../hooks/useGitHubActionsLogs";
import { inferStepStates, safeUi } from "../../ciLite/ciLiteUtils";
import { STORAGE_KEYS } from "../../../lib/storageKeys";
import { WORKFLOW_CI_LITE, WORKFLOW_CI_LITE_AUTOFIX, type StepState } from "../types";

export function useCiLiteWorkflow() {
  const { activeRepo, activeBranch } = useGitHub();
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

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Derived repo/branch ----
  const githubRepo = useMemo(
    () => (activeRepo?.trim() || projectData?.linkedRepo?.trim() || "").trim(),
    [activeRepo, projectData?.linkedRepo],
  );
  const branch = useMemo(
    () => (activeBranch?.trim() || projectData?.linkedBranch?.trim() || "").trim(),
    [activeBranch, projectData?.linkedBranch],
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

  const showError = safeUi(localError || logsError || "");

  const ok = useMemo(() => {
    if (!done) return false;
    if ((workflowRun?.conclusion || "").toLowerCase() === "success") return true;
    return onlyErrors.length === 0 && !showError;
  }, [done, workflowRun?.conclusion, onlyErrors.length, showError]);

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
    const lintOk = isSuccess || stepInfo.lint === "success";
    const typeOk = isSuccess || stepInfo.typecheck === "success";
    void AsyncStorage.multiSet([
      [STORAGE_KEYS.CI_LITE_LINT_OK, lintOk ? "true" : "false"],
      [STORAGE_KEYS.CI_LITE_TYPECHECK_OK, typeOk ? "true" : "false"],
      [STORAGE_KEYS.CI_LITE_LAST_RUN_AT, String(Date.now())],
    ]).catch(() => {});
  }, [workflowRun, workflowId, stepInfo.lint, stepInfo.typecheck]);

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
            inputs: { ref: targetBranch, job_id: newJobId },
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
