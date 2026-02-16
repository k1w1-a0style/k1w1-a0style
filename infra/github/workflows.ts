import { githubLimiter } from "./rateLimit";
import { getGitHubToken } from "./tokenStore";

export interface WorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  status: "queued" | "in_progress" | "completed" | "waiting";
  conclusion: "success" | "failure" | "cancelled" | "skipped" | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  run_number: number;
}

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

  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFileName)}/dispatches`;
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

  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFileName)}/runs?per_page=5`;
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
    console.warn(
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

  const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=${perPage}`;
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
