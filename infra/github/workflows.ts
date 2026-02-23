import { githubLimiter } from "./rateLimit";
import { getGitHubToken } from "./tokenStore";
import { githubApiUrl } from "../../shared/constants/github";
import { logger } from "../../lib/logger";

export interface WorkflowRun {
  id: number;
  name: string;
  display_title?: string;
  event?: string;
  head_branch: string;
  status: "queued" | "in_progress" | "completed" | "waiting";
  conclusion: "success" | "failure" | "cancelled" | "skipped" | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  run_number: number;
}

// === Run Details / Jobs (Luxus) ===
// Minimal typing for GitHub Actions APIs:
// GET /repos/{owner}/{repo}/actions/runs/{run_id}
// GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs

export interface WorkflowRunDetails {
  id: number;
  event?: string;
  status?: string;
  conclusion?: string | null;
  html_url?: string;
  actor?: { login?: string } | null;
  triggering_actor?: { login?: string } | null;
  repository?: { full_name?: string } | null;
}

export interface WorkflowJobStep {
  name: string;
  status: string;
  conclusion?: string | null;
}

export interface WorkflowJob {
  id: number;
  name: string;
  status: string;
  conclusion?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  html_url?: string | null;
  steps?: WorkflowJobStep[];
}

export const getWorkflowRunDetails = async (
  owner: string,
  repo: string,
  runId: number,
): Promise<WorkflowRunDetails> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");
  await githubLimiter.checkLimit();

  const url = githubApiUrl(`/repos/${owner}/${repo}/actions/runs/${runId}`);
  const resp = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const status = resp.status;
    if (status === 401) throw new Error("GitHub Token ungültig.");
    if (status === 403) throw new Error("Keine Berechtigung für Run-Details.");
    if (status === 404) throw new Error("Run oder Repository nicht gefunden.");
    throw new Error(json.message || `Run-Details Fehler (${status})`);
  }
  return json as WorkflowRunDetails;
};

export const getWorkflowRunJobs = async (
  owner: string,
  repo: string,
  runId: number,
): Promise<WorkflowJob[]> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");
  await githubLimiter.checkLimit();

  const url = githubApiUrl(`/repos/${owner}/${repo}/actions/runs/${runId}/jobs?per_page=100`);
  const resp = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const status = resp.status;
    if (status === 401) throw new Error("GitHub Token ungültig.");
    if (status === 403) throw new Error("Keine Berechtigung für Jobs.");
    if (status === 404) throw new Error("Run oder Repository nicht gefunden.");
    throw new Error(json.message || `Jobs Fehler (${status})`);
  }
  return (json.jobs || []) as WorkflowJob[];
};

export const triggerWorkflow = async (
  owner: string,
  repo: string,
  workflowFileName = "eas-build.yml",
  ref = "main",
  inputs = {},
) => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  await githubLimiter.checkLimit();

  const url = githubApiUrl(`/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFileName)}/dispatches`);
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref, inputs }),
  });

  if (resp.status === 204) return { started: true };

  const status = resp.status;
  if (status === 401) throw new Error("GitHub Token ungültig.");
  if (status === 403) throw new Error("Keine Berechtigung für Workflow-Trigger.");
  if (status === 404) {
    throw new Error(
      `Workflow nicht gefunden. Stelle sicher, dass '${workflowFileName}' im '.github/workflows' Ordner auf GitHub (Branch '${ref}') existiert.`,
    );
  }

  const json = await resp.json().catch(() => ({}));
  throw new Error(json.message || "workflow dispatch failed");
};

export const getWorkflowRuns = async (
  owner: string,
  repo: string,
  workflowFileName = "eas-build.yml",
) => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  await githubLimiter.checkLimit();

  const url = githubApiUrl(`/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFileName)}/runs?per_page=5`);
  const resp = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });

  const remaining = resp.headers.get("X-RateLimit-Remaining");
  const reset = resp.headers.get("X-RateLimit-Reset");

  if (remaining && parseInt(remaining) < 100) {
    const resetDate = reset
      ? new Date(parseInt(reset) * 1000).toLocaleTimeString()
      : "unbekannt";
    logger.warn(
      `⚠️ [GitHub API] Niedriges Rate Limit: ${remaining} Anfragen übrig. Reset: ${resetDate}`,
    );
  }

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const status = resp.status;
    if (status === 401) throw new Error("GitHub Token ungültig.");
    if (status === 403) throw new Error("Keine Berechtigung für Workflow-Abfrage.");
    if (status === 404) throw new Error("Workflow oder Repository nicht gefunden.");
    throw new Error(json.message || "get runs failed");
  }
  return json;
};

export const getAllWorkflowRuns = async (
  owner: string,
  repo: string,
  perPage = 10,
): Promise<WorkflowRun[]> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  await githubLimiter.checkLimit();

  const url = githubApiUrl(`/repos/${owner}/${repo}/actions/runs?per_page=${perPage}`);
  const resp = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!resp.ok) {
    const status = resp.status;
    if (status === 401) throw new Error("GitHub Token ungültig.");
    if (status === 403) throw new Error("Keine Berechtigung.");
    if (status === 404) throw new Error("Repository nicht gefunden.");
    const text = await resp.text();
    throw new Error(`Workflow Runs Fehler (${status}): ${text}`);
  }

  const json = await resp.json();
  return (json.workflow_runs || []) as WorkflowRun[];
};