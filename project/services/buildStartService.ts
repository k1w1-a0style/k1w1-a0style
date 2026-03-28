import type { ProjectData, ProjectFile } from "../../shared/types/project";
// project/services/buildStartService.ts
// Extracted from ProjectContext.startBuild to keep ProjectContext lean.
// Behavior is intentionally kept the same.

import { ensureSupabaseClient } from "../../lib/supabase";
import { logger } from "../../lib/logger";
import {
  getWorkflowAdminKey,
  pushFilesToRepo,
} from "../../infra/github/githubService";
import { SUPABASE_EDGE_FUNCTIONS } from "../../shared/constants/supabase";
import { autoFixCIWorkflows } from "../../lib/diagnostics/ciAutoFix";
import { getRepoSyncState, markRepoSyncSignature } from "../../lib/repoSyncOrchestration";
import {
  assertBuildReadiness as assertBuildReadinessContract,
  type BuildReadinessDeps,
} from "../../lib/buildReadiness";

export type StartBuildProfile = "development" | "preview" | "production";

export type StartBuildJobResult = {
  jobId: string;
  githubRepo: string;
  branch: string;
  buildProfile: StartBuildProfile;
};

type EdgeBuildInvokePayload = {
  ok?: boolean;
  error?: string;
  details?: { message?: unknown };
  jobId?: unknown;
  job_id?: unknown;
  job?: { id?: unknown };
};

function normalizeProfile(profile?: string): StartBuildProfile {
  return profile === "development" || profile === "preview" || profile === "production"
    ? profile
    : "preview";
}

function normalizeBuildJobId(raw: unknown): string | null {
  if (typeof raw === "number") {
    return Number.isInteger(raw) && raw > 0 ? String(raw) : null;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return /^[1-9]\d*$/.test(trimmed) ? trimmed : null;
  }
  return null;
}

function asEdgeBuildInvokePayload(raw: unknown): EdgeBuildInvokePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const details =
    obj.details && typeof obj.details === "object"
      ? (obj.details as Record<string, unknown>)
      : undefined;
  const job = obj.job && typeof obj.job === "object" ? (obj.job as Record<string, unknown>) : undefined;
  return {
    ok: typeof obj.ok === "boolean" ? obj.ok : undefined,
    error: typeof obj.error === "string" ? obj.error : undefined,
    details: details ? { message: details.message } : undefined,
    jobId: obj.jobId,
    job_id: obj.job_id,
    job: job ? { id: job.id } : undefined,
  };
}

export async function assertBuildReadiness(
  project: ProjectData,
  deps: BuildReadinessDeps = {},
): Promise<void> {
  await assertBuildReadinessContract(project, deps);
}

async function bestEffortPushToGitHub(opts: {
  githubRepo: string;
  branch: string;
  files: ProjectFile[];
  storageSetItem?: (key: string, value: string) => Promise<void>;
}): Promise<string> {
  const { githubRepo, branch, files, storageSetItem } = opts;

  // Defensive helper guard: this helper can still be reused independently of startBuildJob.
  if (!githubRepo || !githubRepo.includes("/")) {
    throw new Error('Kein GitHub-Repo verbunden. Bitte in "Connections" ein Repo verknuepfen.');
  }

  const [owner, repo] = githubRepo.split("/");

  if (owner && repo && files?.length) {
    try {
      await pushFilesToRepo(owner, repo, files, branch);
    } catch (err) {
      // Best-effort: even if push fails (e.g. permissions, network),
      // we still try to ensure workflows exist and proceed with the build using the linked branch.
      logger.warn("Push nach GitHub fehlgeschlagen (best-effort). Fahre fort mit Workflow-Autofix.", {
        owner,
        repo,
        branch,
        err,
      });
    }
  }

  // Ensure required CI/EAS workflows exist in the linked repo.
  // This app is an APK builder: the linked repo (e.g. "musik-player") is the *target project repo*.
  // Workflows must live there so we can trigger them reliably.
  try {
    await autoFixCIWorkflows({ owner, repo, branch });
  } catch (err) {
    logger.warn("CI/EAS Workflows konnten nicht automatisch gesetzt werden", { err });
  }

  await markRepoSyncSignature({
    linkedRepo: githubRepo,
    linkedBranch: branch,
    files,
    storageSetItem,
  });

  return branch;
}

export async function startBuildJob(params: {
  project: ProjectData;
  buildProfile?: string;
  deps?: BuildReadinessDeps;
}): Promise<StartBuildJobResult> {
  const { project, buildProfile, deps } = params;

  if (!project?.files || project.files.length === 0) {
    throw new Error("Projekt ist leer. Es gibt keine Dateien zum Bauen.");
  }

  await assertBuildReadiness(project, deps);

  // Repo/branch gating now comes from the centralized readiness contract above.
  const githubRepo = (project.linkedRepo?.trim() || "").trim();
  const profile = normalizeProfile(buildProfile);
  const buildBranch = (project.linkedBranch ?? "").trim();

  const syncState = await getRepoSyncState({
    linkedRepo: githubRepo,
    linkedBranch: buildBranch,
    files: project.files,
    storageGetItem: deps?.storageGetItem,
  });
  if (syncState === "unknown") {
    throw new Error("Build blockiert: Sync-Status lokal↔Repo ist unklar. Bitte zuerst explizit pushen und danach erneut starten.");
  }

  if (syncState === "out_of_sync") {
    await bestEffortPushToGitHub({
      githubRepo,
      branch: buildBranch,
      files: project.files,
      storageSetItem: deps?.storageSetItem,
    });
  }

  const supabase = await ensureSupabaseClient();
  const workflowAdminKey = await getWorkflowAdminKey().catch(() => null);
  const session = await supabase.auth.getSession().catch(() => null);
  const accessToken = session?.data?.session?.access_token ?? null;

  if (!accessToken) {
    throw new Error(
      "Build-Start blockiert: Der aktuelle Supabase-Login hat keine Operator-Rolle. Erforderlich ist JWT role=build_admin (oder service_role fuer Server-Caller). build_admin wird im Betriebs-/Provisioning-Prozess ausserhalb dieses Repos per Supabase-User-Claim vergeben.",
    );
  }
  if (!workflowAdminKey) {
    throw new Error(
      "Build-Start blockiert: Lokaler Workflow-Admin-Key fehlt. Bitte Verbindungen pruefen und erneut versuchen.",
    );
  }

  const invokeOpts: { body: Record<string, string>; headers?: Record<string, string> } = {
    body: { githubRepo, buildProfile: profile, branch: buildBranch },
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-k1w1-admin-key": workflowAdminKey,
    },
  };

  const { data, error } = await supabase.functions.invoke(
    SUPABASE_EDGE_FUNCTIONS.TRIGGER_EAS_BUILD,
    invokeOpts,
  );

  if (error) throw error;

  const payload = asEdgeBuildInvokePayload(data);

  // Some edge functions might respond with HTTP 200 but an error-shaped payload.
  // Normalize that to a thrown error so the UI shows the real reason (instead of 'no job id').
  if (payload?.ok === false) {
    const msg = payload.error || (payload.details?.message ? String(payload.details.message) : "Unbekannter Fehler");
    throw new Error(msg);
  }

  const jobId: string | null =
    normalizeBuildJobId(payload?.jobId) ??
    normalizeBuildJobId(payload?.job_id) ??
    normalizeBuildJobId(payload?.job?.id);

  if (!jobId) {
    throw new Error(
      `${SUPABASE_EDGE_FUNCTIONS.TRIGGER_EAS_BUILD} lieferte keine gueltige Job-ID (positive numerische ID erwartet) zurueck.`,
    );
  }

  return {
    jobId,
    githubRepo,
    branch: buildBranch,
    buildProfile: profile,
  };
}
