import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ProjectData, ProjectFile } from "../../shared/types/project";
// project/services/buildStartService.ts
// Extracted from ProjectContext.startBuild to keep ProjectContext lean.
// Behavior is intentionally kept the same.


import { ensureSupabaseClient } from "../../lib/supabase";
import { logger } from "../../lib/logger";
import {
  getEdgeAdminKey,
  pushFilesToRepo,
} from "../../infra/github/githubService";
import { SUPABASE_EDGE_FUNCTIONS } from "../../shared/constants/supabase";
import { autoFixCIWorkflows } from "../../lib/diagnostics/ciAutoFix";
import { STORAGE_KEYS } from "../../lib/storageKeys";
import {
  BUILD_READINESS_ERROR_MESSAGES,
  ERR_BRANCH_MISSING,
  ERR_DIAGNOSTIC_NOT_GREEN,
} from "../../lib/errors/buildReadinessErrors";

export type StartBuildProfile = "development" | "preview" | "production";

export type StartBuildJobResult = {
  jobId: string;
  githubRepo: string;
  branch: string;
  buildProfile: StartBuildProfile;
};

function normalizeProfile(profile?: string): StartBuildProfile {
  return profile === "development" || profile === "preview" || profile === "production"
    ? profile
    : "preview";
}

function isUuid(id: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
}

export type BuildReadinessDeps = {
  storageGetItem?: (key: string) => Promise<string | null>;
};

const CI_LITE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export async function assertBuildReadiness(
  project: ProjectData,
  deps: BuildReadinessDeps = {},
): Promise<void> {
  const storageGetItem = deps.storageGetItem ?? ((key: string) => AsyncStorage.getItem(key));
  const linkedRepo = typeof project?.linkedRepo === "string" ? project.linkedRepo.trim() : "";
  const linkedBranch = typeof project?.linkedBranch === "string" ? project.linkedBranch.trim() : "";
  if (!linkedRepo || !linkedRepo.includes("/")) {
    throw new Error('Kein gültiges Ziel-Repo verknüpft. Bitte in "Connections" ein Repo auswählen.');
  }
  if (!linkedBranch) {
    throw new Error(`${ERR_BRANCH_MISSING}: ${BUILD_READINESS_ERROR_MESSAGES[ERR_BRANCH_MISSING]}`);
  }

  const [diagVal, lintVal, typeVal, lastRunAt, lastRepo, lastBranch] = await Promise.all([
    storageGetItem(STORAGE_KEYS.DIAGNOSTIC_LAST_OK).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_LINT_OK).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_TYPECHECK_OK).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_LAST_RUN_AT).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_LAST_REPO).catch(() => null),
    storageGetItem(STORAGE_KEYS.CI_LITE_LAST_BRANCH).catch(() => null),
  ]);

  if (diagVal !== "true") {
    throw new Error(
      `${ERR_DIAGNOSTIC_NOT_GREEN}: ${BUILD_READINESS_ERROR_MESSAGES[ERR_DIAGNOSTIC_NOT_GREEN]}`,
    );
  }

  if (lintVal !== "true" || typeVal !== "true") {
    throw new Error("Build blockiert: CI Lite (Lint + Typecheck) ist für dieses Ziel noch nicht grün.");
  }

  if ((lastRepo ?? "").trim() !== linkedRepo) {
    throw new Error("Build blockiert: Letzter CI-Lite-Run gehört zu einem anderen Repo.");
  }

  if ((lastBranch ?? "").trim() !== linkedBranch) {
    throw new Error("Build blockiert: Letzter CI-Lite-Run gehört zu einem anderen Branch.");
  }

  const ts = Number(lastRunAt ?? "");
  if (!Number.isFinite(ts) || ts <= 0) {
    throw new Error("Build blockiert: Kein gültiger Zeitstempel für den letzten CI-Lite-Run vorhanden.");
  }

  if (Date.now() - ts > CI_LITE_MAX_AGE_MS) {
    throw new Error("Build blockiert: Letzter CI-Lite-Run ist veraltet. Bitte erneut prüfen.");
  }
}

async function bestEffortPushToGitHub(opts: {
  githubRepo: string;
  branch: string;
  files: ProjectFile[];
}): Promise<string> {
  const { githubRepo, branch, files } = opts;

  if (!githubRepo || !githubRepo.includes("/")) {
    throw new Error('Kein GitHub-Repo verbunden. Bitte in "Connections" ein Repo verknuepfen.');
  }

  const [owner, repo] = githubRepo.split("/");

  if (owner && repo && files?.length) {
    try {
      await pushFilesToRepo(owner, repo, files as any, branch);
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

  const githubRepo = (project.linkedRepo?.trim() || "").trim();
  if (!githubRepo || !githubRepo.includes("/")) {
    throw new Error('Kein gültiges Ziel-Repo verknüpft. Bitte in "Connections" ein Repo auswählen.');
  }
  const profile = normalizeProfile(buildProfile);
  const buildBranch = (project.linkedBranch ?? "").trim();

  try {
    await bestEffortPushToGitHub({
      githubRepo,
      branch: buildBranch,
      files: project.files,
    });
  } catch (e) {
    logger.warn("Auto-Push nach GitHub fehlgeschlagen. Build nutzt evtl. alten Repo-Stand", { err: e });
  }

  const supabase = await ensureSupabaseClient();
  const edgeAdminKey = await getEdgeAdminKey().catch(() => null);

  const invokeOpts: { body: any; headers?: Record<string, string> } = {
    body: { githubRepo, buildProfile: profile, branch: buildBranch },
  };
  if (edgeAdminKey) {
    invokeOpts.headers = { "x-k1w1-admin-key": edgeAdminKey };
  }

  const { data, error } = await supabase.functions.invoke(
    SUPABASE_EDGE_FUNCTIONS.TRIGGER_EAS_BUILD,
    invokeOpts,
  );

  if (error) throw error;

  // Some edge functions might respond with HTTP 200 but an error-shaped payload.
  // Normalize that to a thrown error so the UI shows the real reason (instead of 'no job id').
  if ((data as any)?.ok === false) {
    const details = (data as any)?.details;
    const msg = (data as any)?.error || (details?.message ? String(details.message) : "Unbekannter Fehler");
    throw new Error(msg);
  }

  const jobId: string | null =
    typeof (data as any)?.jobId === "string"
      ? (data as any).jobId
      : typeof (data as any)?.job_id === "string"
        ? (data as any).job_id
        : typeof (data as any)?.job?.id === "string"
          ? (data as any).job.id
          : null;

  if (!jobId) {
    throw new Error(`${SUPABASE_EDGE_FUNCTIONS.TRIGGER_EAS_BUILD} lieferte keine gueltige Job-ID zurueck.`);
  }

  if (!isUuid(jobId)) {
    throw new Error(
      `${SUPABASE_EDGE_FUNCTIONS.TRIGGER_EAS_BUILD} lieferte eine ungueltige Job-ID (UUID erwartet): ${jobId}`,
    );
  }

  return {
    jobId,
    githubRepo,
    branch: buildBranch,
    buildProfile: profile,
  };
}
