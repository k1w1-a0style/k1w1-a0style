import type { WorkflowJob, WorkflowJobStep, WorkflowRun, WorkflowRunDetails } from "./workflowTypes";
import {
  JsonRecord,
  isJsonRecord,
  readNumberField,
  readRecordArrayField,
  readStringField,
} from "./githubResponseHelpers";

export type WorkflowListItem = {
  id: number;
  name?: string;
  path?: string;
  state?: string;
};

const readOptionalString = (record: JsonRecord, key: string): string | undefined => {
  const value = readStringField(record, key);
  return value || undefined;
};

export const readWorkflowListItems = (record: JsonRecord): WorkflowListItem[] =>
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

export const readWorkflowRunDetailsRecord = (record: JsonRecord): WorkflowRunDetails => {
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

export const readWorkflowJobs = (record: JsonRecord): WorkflowJob[] =>
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

export const readWorkflowRuns = (record: JsonRecord): WorkflowRun[] =>
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
      const normalizedConclusion = (conclusion == null || ["success", "failure", "cancelled", "skipped"].includes(conclusion))
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
