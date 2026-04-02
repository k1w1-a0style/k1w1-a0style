import { githubLimiter } from "./rateLimit";
import { getGitHubToken } from "./tokenStore";
import { githubApiUrl } from "../../shared/constants/github";
import { logger } from "../../lib/logger";
import { fetchGitHub } from "./utils";
import { debugLog } from "../../lib/debugOverlay";
import { redactSecrets, truncateWithMarker } from "../../lib/secretRedaction";
import { WORKFLOW_TEMPLATES } from "./workflowTemplates";
import { JsonRecord, isJsonRecord, readGitHubMessage, readJsonRecordSafe, readNumberField, readRecordArrayField, readStringField } from "./githubResponseHelpers";

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

type WorkflowListItem = {
  id: number;
  name?: string;
  path?: string;
  state?: string;
};

const readOptionalString = (record: JsonRecord, key: string): string | undefined => {
  const value = readStringField(record, key);
  return value || undefined;
};

const readWorkflowListItems = (record: JsonRecord): WorkflowListItem[] =>
  readRecordArrayField(record, "workflows")
    .map((entry): WorkflowListItem | null => {
      const id = readNumberField(entry, "id");
      if (id === null) return null;
      return {
        id,
        name: readOptionalString(entry, "name"),
        path: readOptionalString(entry, "path"),
        state: readOptionalString(entry, "state"),
      };
    })
    .filter((entry): entry is WorkflowListItem => entry !== null);

const readWorkflowRunDetailsRecord = (record: JsonRecord): WorkflowRunDetails => {
  const id = readNumberField(record, "id");
  if (id === null) throw new Error("Run-Details Antwort ist ungueltig.");

  const actor = record["actor"];
  const triggeringActor = record["triggering_actor"];
  const repository = record["repository"];

  return {
    id,
    event: readOptionalString(record, "event"),
    status: readOptionalString(record, "status"),
    conclusion: readOptionalString(record, "conclusion") ?? null,
    html_url: readOptionalString(record, "html_url"),
    actor: isJsonRecord(actor) ? { login: readOptionalString(actor, "login") } : null,
    triggering_actor: isJsonRecord(triggeringActor)
      ? { login: readOptionalString(triggeringActor, "login") }
      : null,
    repository: isJsonRecord(repository)
      ? { full_name: readOptionalString(repository, "full_name") }
      : null,
  };
};

const readWorkflowJobs = (record: JsonRecord): WorkflowJob[] =>
  readRecordArrayField(record, "jobs")
    .map((entry): WorkflowJob | null => {
      const id = readNumberField(entry, "id");
      const name = readStringField(entry, "name");
      const status = readStringField(entry, "status");
      if (id === null || !name || !status) return null;
      return {
        id,
        name,
        status,
        conclusion: readOptionalString(entry, "conclusion") ?? null,
        started_at: readOptionalString(entry, "started_at") ?? null,
        completed_at: readOptionalString(entry, "completed_at") ?? null,
        html_url: readOptionalString(entry, "html_url") ?? null,
        steps: readRecordArrayField(entry, "steps")
          .map((step): WorkflowJobStep | null => {
            const stepName = readStringField(step, "name");
            const stepStatus = readStringField(step, "status");
            if (!stepName || !stepStatus) return null;
            return {
              name: stepName,
              status: stepStatus,
              conclusion: readOptionalString(step, "conclusion") ?? null,
            };
          })
          .filter((step): step is WorkflowJobStep => step !== null),
      };
    })
    .filter((job): job is WorkflowJob => job !== null);

const readWorkflowRuns = (record: JsonRecord): WorkflowRun[] =>
  readRecordArrayField(record, "workflow_runs")
    .map((entry): WorkflowRun | null => {
      const id = readNumberField(entry, "id");
      const name = readStringField(entry, "name");
      const headBranch = readStringField(entry, "head_branch");
      const status = readStringField(entry, "status");
      const createdAt = readStringField(entry, "created_at");
      const updatedAt = readStringField(entry, "updated_at");
      const htmlUrl = readStringField(entry, "html_url");
      const runNumber = readNumberField(entry, "run_number");
      if (
        id === null ||
        !name ||
        !headBranch ||
        !status ||
        !createdAt ||
        !updatedAt ||
        !htmlUrl ||
        runNumber === null
      ) {
        return null;
      }
      const normalizedStatus = ["queued", "in_progress", "completed", "waiting"].includes(status)
        ? (status as WorkflowRun["status"])
        : null;
      const conclusion = readOptionalString(entry, "conclusion");
      const normalizedConclusion = conclusion === null || ["success", "failure", "cancelled", "skipped"].includes(conclusion)
        ? ((conclusion ?? null) as WorkflowRun["conclusion"])
        : null;
      if (!normalizedStatus) return null;
      return {
        id,
        name,
        display_title: readOptionalString(entry, "display_title"),
        event: readOptionalString(entry, "event"),
        head_branch: headBranch,
        status: normalizedStatus,
        conclusion: normalizedConclusion,
        created_at: createdAt,
        updated_at: updatedAt,
        html_url: htmlUrl,
        run_number: runNumber,
      };
    })
    .filter((run): run is WorkflowRun => run !== null);

const resolveWorkflowId = async (
  owner: string,
  repo: string,
  workflowFileName: string,
): Promise<{ id: number; match: WorkflowListItem | null; available: string[] } | null> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  await githubLimiter.checkLimit();

  const url = githubApiUrl(`/repos/${owner}/${repo}/actions/workflows?per_page=100`);
  const resp = await fetchGitHub(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await readJsonRecordSafe(resp);
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
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");
  await githubLimiter.checkLimit();

  const url = githubApiUrl(`/repos/${owner}/${repo}/actions/runs/${runId}`);
  const resp = await fetchGitHub(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await readJsonRecordSafe(resp);
  if (!resp.ok) {
    const status = resp.status;
    if (status === 401) throw new Error("GitHub Token ungültig.");
    if (status === 403) throw new Error("Keine Berechtigung für Run-Details.");
    if (status === 404) throw new Error("Run oder Repository nicht gefunden.");
    throw new Error(readGitHubMessage(json) || `Run-Details Fehler (${status})`);
  }
  return readWorkflowRunDetailsRecord(json);
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
  const resp = await fetchGitHub(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await readJsonRecordSafe(resp);
  if (!resp.ok) {
    const status = resp.status;
    if (status === 401) throw new Error("GitHub Token ungültig.");
    if (status === 403) throw new Error("Keine Berechtigung für Jobs.");
    if (status === 404) throw new Error("Run oder Repository nicht gefunden.");
    throw new Error(readGitHubMessage(json) || `Jobs Fehler (${status})`);
  }
  return readWorkflowJobs(json);
};

export const triggerWorkflow = async (
  owner: string,
  repo: string,
  workflowFileName = "eas-build.yml",
  ref?: string,
  inputs = {},
) => {
  const targetRef = String(ref ?? "").trim();
  if (!targetRef) throw new Error("Explicit branch/ref is required.");

  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");

  await githubLimiter.checkLimit();

  const dispatchByFileUrl = githubApiUrl(
    `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFileName)}/dispatches`,
  );

  const doDispatch = async (url: string) =>
    fetchGitHub(url, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: targetRef, inputs }),
    });

  debugLog("github:workflow", "Dispatch workflow", {
    url: dispatchByFileUrl,
    owner,
    repo,
    workflowFileName,
    ref: targetRef,
    inputs: Object.keys(inputs || {}),
  });

  // 1) Fast path: dispatch by file name.
  let resp = await doDispatch(dispatchByFileUrl);

  // 2) If not found: resolve workflow ID and dispatch by ID.
  let resolved: Awaited<ReturnType<typeof resolveWorkflowId>> | null = null;
  if (resp.status === 404) {
    resolved = await resolveWorkflowId(owner, repo, workflowFileName).catch(
      () => null,
    );
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

  const raw = await resp.text().catch(() => "");
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
    // Best-effort context for the user.
    if (!resolved) {
      resolved = await resolveWorkflowId(owner, repo, workflowFileName).catch(
        () => null,
      );
    }
    const availableHint = resolved?.available?.length
      ? `Verfügbar: ${resolved.available.slice(0, 8).join(", ")}${resolved.available.length > 8 ? " …" : ""}`
      : "";
    const bootstrapHint = WORKFLOW_TEMPLATES[workflowFileName]
      ? "Dispatch bleibt fail-closed ohne Repo-Mutation. Fuer Reparatur/Bootstrap nutze den expliziten Workflow-Autofix-/Provisioning-Pfad."
      : "Die Workflow-Datei fehlt in diesem Repo/Branch. (Tipp: RepoScreen → Workflows/Core Files pushen oder Workflow hinzufügen.)";
    throw new Error(
      `missing_workflow: '${workflowFileName}' existiert nicht unter '.github/workflows' auf Branch '${targetRef}'. ${bootstrapHint}${availableHint ? " " + availableHint : ""}`,
    );
  }

  let json: JsonRecord = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    json = isJsonRecord(parsed) ? parsed : {};
  } catch {
    json = {};
  }
  throw new Error(readGitHubMessage(json) || "workflow dispatch failed");
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
  const resp = await fetchGitHub(url, {
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

  const json = await readJsonRecordSafe(resp);
  if (!resp.ok) {
    const status = resp.status;
    if (status === 401) throw new Error("GitHub Token ungültig.");
    if (status === 403) throw new Error("Keine Berechtigung für Workflow-Abfrage.");
    if (status === 404) throw new Error("Workflow oder Repository nicht gefunden.");
    throw new Error(readGitHubMessage(json) || "get runs failed");
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
  const resp = await fetchGitHub(url, {
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

  const json = await readJsonRecordSafe(resp);
  return readWorkflowRuns(json);
};
