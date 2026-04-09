import { logger } from "../../lib/logger";
import { fetchGitHub } from "./utils";
import { debugLog } from "../../lib/debugOverlay";
import { redactSecrets, truncateWithMarker } from "../../lib/secretRedaction";
import { WORKFLOW_TEMPLATES } from "./workflowTemplates";
import { JsonRecord, isJsonRecord, readGitHubMessage } from "./githubResponseHelpers";
import {
  checkGitHubWorkflowRateLimit,
  fetchGitHubRecord,
  requireGitHubAuthHeaders,
  throwCommonWorkflowError,
} from "./workflowApiHelpers";
import {
  readWorkflowJobs,
  readWorkflowListItems,
  readWorkflowRunDetailsRecord,
  readWorkflowRuns,
  type WorkflowListItem,
} from "./workflowResponseParsers";
import { githubApiUrl } from "../../shared/constants/github";
import type { WorkflowJob, WorkflowRun, WorkflowRunDetails } from "./workflowTypes";
export type { WorkflowJob, WorkflowJobStep, WorkflowRun, WorkflowRunDetails } from "./workflowTypes";

async function tryResolveWorkflowId(
  owner: string,
  repo: string,
  workflowFileName: string,
): Promise<Awaited<ReturnType<typeof resolveWorkflowId>> | null> {
  try {
    return await resolveWorkflowId(owner, repo, workflowFileName);
  } catch (error) {
    logger.warn("[GitHub workflows] resolveWorkflowId failed", {
      owner,
      repo,
      workflowFileName,
      error,
    });
    return null;
  }
}

async function readResponseTextSafe(response: Response, context: string): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    logger.warn("[GitHub workflows] response.text failed", { context, error, status: response.status });
    return "response_text_unavailable";
  }
}

const resolveWorkflowId = async (
  owner: string,
  repo: string,
  workflowFileName: string,
): Promise<{ id: number; match: WorkflowListItem | null; available: string[] } | null> => {
  const headers = await requireGitHubAuthHeaders();
  const { resp, json } = await fetchGitHubRecord(
    `/repos/${owner}/${repo}/actions/workflows?per_page=100`,
    headers,
  );
  if (!resp.ok) return null;

  const workflows = readWorkflowListItems(json);
  const available = workflows
    .map((w) => w.path || w.name || String(w.id))
    .filter(Boolean) as string[];

  const target = workflowFileName.toLowerCase();
  const match = workflows.find((w) => {
    const p = (w.path || "").toLowerCase();
    const n = (w.name || "").toLowerCase();
    return p.endsWith(`/${target}`) || p.endsWith(target) || n === target;
  }) || null;

  return { id: match?.id || 0, match, available };
};

export const getWorkflowRunDetails = async (
  owner: string,
  repo: string,
  runId: number,
): Promise<WorkflowRunDetails> => {
  const headers = await requireGitHubAuthHeaders();
  const { resp, json } = await fetchGitHubRecord(
    `/repos/${owner}/${repo}/actions/runs/${runId}`,
    headers,
  );
  if (!resp.ok) {
    throwCommonWorkflowError(resp.status, json, `Run-Details Fehler (${resp.status})`, {
      401: "GitHub Token ungültig.",
      403: "Keine Berechtigung für Run-Details.",
      404: "Run oder Repository nicht gefunden.",
    });
  }
  return readWorkflowRunDetailsRecord(json);
};

export const getWorkflowRunJobs = async (
  owner: string,
  repo: string,
  runId: number,
): Promise<WorkflowJob[]> => {
  const headers = await requireGitHubAuthHeaders();
  const { resp, json } = await fetchGitHubRecord(
    `/repos/${owner}/${repo}/actions/runs/${runId}/jobs?per_page=100`,
    headers,
  );
  if (!resp.ok) {
    throwCommonWorkflowError(resp.status, json, `Jobs Fehler (${resp.status})`, {
      401: "GitHub Token ungültig.",
      403: "Keine Berechtigung für Jobs.",
      404: "Run oder Repository nicht gefunden.",
    });
  }
  return readWorkflowJobs(json);
};

// Orchestrator bewusst zentral: Dispatch-Flow verbindet RateLimit/Auth/Fallback-ID/Fehler-Mapping in einem fail-closed Pfad.
// Weitere Zerlegung ist moeglich, bringt hier aber aktuell keinen klaren Sicherheits-/Wartungsgewinn ohne source-contract Risiken.
export const triggerWorkflow = async (
  owner: string,
  repo: string,
  workflowFileName = "eas-build.yml",
  ref?: string,
  inputs = {},
) => {
  const targetRef = String(ref ?? "").trim();
  if (!targetRef) throw new Error("Explicit branch/ref is required.");

  const headers = await requireGitHubAuthHeaders();
  const dispatchByFilePath =
    `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFileName)}/dispatches`;
  const dispatchByFileUrl = githubApiUrl(dispatchByFilePath);

  const doDispatch = async (url: string) => {
    await checkGitHubWorkflowRateLimit();
    return fetchGitHub(url, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: targetRef, inputs }),
    });
  };

  debugLog("github:workflow", "Dispatch workflow", {
    url: dispatchByFileUrl,
    owner,
    repo,
    workflowFileName,
    ref: targetRef,
    inputs: Object.keys(inputs || {}),
  });

  let resp = await doDispatch(dispatchByFileUrl);

  let resolved: Awaited<ReturnType<typeof resolveWorkflowId>> | null = null;
  if (resp.status === 404) {
    resolved = await tryResolveWorkflowId(owner, repo, workflowFileName);
    if (resolved?.id) {
      const dispatchByIdUrl = githubApiUrl(
        `/repos/${owner}/${repo}/actions/workflows/${resolved.id}/dispatches`,
      );
      debugLog("github:workflow", "Dispatch workflow (resolved id)", {
        url: dispatchByIdUrl,
        owner,
        repo,
        workflowFileName,
        ref: targetRef,
        resolved,
      });
      resp = await doDispatch(dispatchByIdUrl);
    }
  }

  const raw = await readResponseTextSafe(resp, "workflow_dispatch");
  debugLog("github:workflow", "Dispatch response", {
    status: resp.status,
    ok: resp.status === 204,
    body: redactSecrets(truncateWithMarker(raw, 800)),
  });

  if (resp.status === 204) return { started: true };

  const status = resp.status;
  if (status === 401) throw new Error("GitHub Token ungültig.");
  if (status === 403) throw new Error("Keine Berechtigung für Workflow-Trigger.");
  if (status === 404) {
    if (!resolved) {
      resolved = await tryResolveWorkflowId(owner, repo, workflowFileName);
    }
    const availableHint = resolved?.available?.length
      ? `Verfügbar: ${resolved.available.slice(0, 8).join(", ")}${resolved.available.length > 8 ? " …" : ""}`
      : "";
    const bootstrapHint = WORKFLOW_TEMPLATES[workflowFileName]
      ? "Dispatch bleibt fail-closed ohne Repo-Mutation. Fuer Reparatur/Bootstrap nutze den expliziten Workflow-Autofix-/Provisioning-Pfad."
      : "Die Workflow-Datei fehlt in diesem Repo/Branch. (Tipp: RepoScreen → Workflows/Core Files pushen oder Workflow hinzufügen.)";
    throw new Error(
      `missing_workflow: '${workflowFileName}' existiert nicht unter '.github/workflows' auf Branch '${targetRef}'. ${bootstrapHint}${availableHint ? ` ${availableHint}` : ""}`,
    );
  }

  let json: JsonRecord = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    json = isJsonRecord(parsed) ? parsed : {};
  } catch (error) {
    logger.warn("[GitHub workflows] dispatch error response parse failed", {
      owner,
      repo,
      workflowFileName,
      ref: targetRef,
      status,
      error,
    });
    json = {};
  }
  throw new Error(readGitHubMessage(json) || "workflow dispatch failed");
};

export const getWorkflowRuns = async (
  owner: string,
  repo: string,
  workflowFileName = "eas-build.yml",
) => {
  const headers = await requireGitHubAuthHeaders();
  const { resp, json } = await fetchGitHubRecord(
    `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFileName)}/runs?per_page=5`,
    headers,
  );

  const remaining = resp.headers.get("X-RateLimit-Remaining");
  const reset = resp.headers.get("X-RateLimit-Reset");

  if (remaining && parseInt(remaining, 10) < 100) {
    const resetDate = reset
      ? new Date(parseInt(reset, 10) * 1000).toLocaleTimeString()
      : "unbekannt";
    logger.warn(
      `⚠️ [GitHub API] Niedriges Rate Limit: ${remaining} Anfragen übrig. Reset: ${resetDate}`,
    );
  }

  if (!resp.ok) {
    throwCommonWorkflowError(resp.status, json, "get runs failed", {
      401: "GitHub Token ungültig.",
      403: "Keine Berechtigung für Workflow-Abfrage.",
      404: "Workflow oder Repository nicht gefunden.",
    });
  }
  return json;
};

export const getAllWorkflowRuns = async (
  owner: string,
  repo: string,
  perPage = 10,
): Promise<WorkflowRun[]> => {
  const headers = await requireGitHubAuthHeaders();
  const { resp, json } = await fetchGitHubRecord(
    `/repos/${owner}/${repo}/actions/runs?per_page=${perPage}`,
    headers,
  );

  if (!resp.ok) {
    const status = resp.status;
    if (status === 401) throw new Error("GitHub Token ungültig.");
    if (status === 403) throw new Error("Keine Berechtigung.");
    if (status === 404) throw new Error("Repository nicht gefunden.");
    const text = await readResponseTextSafe(resp, "get_all_workflow_runs");
    throw new Error(`Workflow Runs Fehler (${status}): ${text}`);
  }

  return readWorkflowRuns(json);
};
