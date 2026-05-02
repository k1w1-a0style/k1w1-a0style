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
import {
  getRepoSyncState,
  hasConflictingCanonicalFileVariants,
  markRepoSyncSignature,
} from "../../lib/repoSyncOrchestration";
import { hasLikelyAllowedOperatorRoleForUiPrecheck } from "../../lib/auth/operatorJwt";
import { buildEdgeOwnerAuthHeaders } from "../../lib/edgeOwnerAuthHeaders";
import { buildOperatorPrecheckMessage } from "../../lib/auth/operatorContract";
import { getCanonicalProjectFilesForOps, getSourceProjectFiles } from "../../lib/getMaterializedProjectFiles";
import {
  assertBuildReadiness as assertBuildReadinessContract,
  type BuildReadinessDeps,
  type BuildReadinessOptions,
} from "../../lib/buildReadiness";

// Invariant marker phrases for operator-provisioning contract checks:
// "JWT role=build_admin (oder service_role fuer Server-Caller)"
// "ausserhalb dieses Repos per Supabase-User-Claim vergeben"
// "Normale eingeloggte Nutzer ohne extern provisionierten build_admin-Claim"

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

type ParsedGitHubRepo = {
  fullName: string;
  owner: string;
  repo: string;
};

const GITHUB_REPO_SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

function normalizeGitHubRepoFullName(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

function parseStrictGitHubRepoFullName(raw: unknown): ParsedGitHubRepo | null {
  const normalized = normalizeGitHubRepoFullName(raw);
  if (!normalized) return null;
  if (/\s/.test(normalized)) return null;

  const parts = normalized.split("/");
  if (parts.length !== 2) return null;

  const [owner, repo] = parts;
  if (!owner || !repo) return null;
  if (!GITHUB_REPO_SEGMENT_PATTERN.test(owner) || !GITHUB_REPO_SEGMENT_PATTERN.test(repo)) return null;
  if (owner.endsWith(".") || repo.endsWith(".")) return null;
  if (owner.includes("..") || repo.includes("..")) return null;

  return {
    fullName: `${owner}/${repo}`,
    owner,
    repo,
  };
}

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
  options: BuildReadinessOptions = {},
): Promise<void> {
  await assertBuildReadinessContract(project, deps, options);
}

async function pushProjectFilesOrAbortBuild(opts: {
  githubRepo: string;
  branch: string;
  files: ProjectFile[];
  storageSetItem?: (key: string, value: string) => Promise<void>;
}): Promise<string> {
  const { githubRepo, branch, files, storageSetItem } = opts;
  const normalizedGithubRepo = normalizeGitHubRepoFullName(githubRepo);
  const parsedRepo = parseStrictGitHubRepoFullName(normalizedGithubRepo);

  // Defensive helper guard: this helper can still be reused independently of startBuildJob.
  if (!parsedRepo) {
    throw new Error('Kein GitHub-Repo verbunden. Bitte in "Connections" ein Repo verknuepfen.');
  }

  const { owner, repo } = parsedRepo;

  if (owner && repo && files?.length) {
    try {
      await pushFilesToRepo(owner, repo, files, branch);
    } catch (err) {
      logger.warn("Build-Start abgebrochen: Push nach GitHub fehlgeschlagen.", {
        owner,
        repo,
        branch,
        err,
      });
      throw new Error(
        "Build abgebrochen: Lokale Aenderungen konnten nicht erfolgreich ins Ziel-Repo gepusht werden.",
      );
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
    linkedRepo: parsedRepo.fullName,
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
  const sourceFiles = getSourceProjectFiles(project);
  const canonicalOpsFiles = getCanonicalProjectFilesForOps(project);

  if (!canonicalOpsFiles.length) {
    throw new Error("Projekt ist leer. Es gibt keine Dateien zum Bauen.");
  }

  const normalizedGithubRepo = normalizeGitHubRepoFullName(project.linkedRepo);
  const parsedRepo = parseStrictGitHubRepoFullName(normalizedGithubRepo);
  if (!parsedRepo) {
    throw new Error('GitHub-Repo ist ungueltig. Erwartet wird exakt "owner/repo" ohne Leerzeichen oder Zusatzsegmente.');
  }

  const githubRepo = parsedRepo.fullName;

  await assertBuildReadiness(project, deps, { projectFiles: canonicalOpsFiles });

  // Repo/branch gating now comes from the centralized readiness contract above.
  const profile = normalizeProfile(buildProfile);
  const buildBranch = (project.linkedBranch ?? "").trim();

  if (hasConflictingCanonicalFileVariants(sourceFiles)) {
    throw new Error("Build blockiert: Sync-Status lokal↔Repo ist unklar. Bitte zuerst explizit pushen und danach erneut starten.");
  }

  const syncState = await getRepoSyncState({
    linkedRepo: githubRepo,
    linkedBranch: buildBranch,
    files: canonicalOpsFiles,
    storageGetItem: deps?.storageGetItem,
  });
  if (syncState === "unknown") {
    throw new Error("Build blockiert: Sync-Status lokal↔Repo ist unklar. Bitte zuerst explizit pushen und danach erneut starten.");
  }

  if (syncState === "out_of_sync") {
    await pushProjectFilesOrAbortBuild({
      githubRepo,
      branch: buildBranch,
      files: canonicalOpsFiles,
      storageSetItem: deps?.storageSetItem,
    });
  }

  const supabase = await ensureSupabaseClient();
  const workflowAdminKey = await getWorkflowAdminKey().catch((error: unknown) => {
    logger.warn("[buildStartService] getWorkflowAdminKey failed", { error });
    return null;
  });
  const session = await supabase.auth.getSession().catch((error: unknown) => {
    logger.warn("[buildStartService] auth.getSession failed", { error });
    return null;
  });
  const accessToken = session?.data?.session?.access_token ?? null;

  const trimmedAdminKey = String(workflowAdminKey ?? "").trim();
  if (!trimmedAdminKey && !accessToken) {
    throw new Error(buildOperatorPrecheckMessage({ action: "Build-Start", reason: "missing_jwt" }));
  }
  if (!trimmedAdminKey && accessToken && !hasLikelyAllowedOperatorRoleForUiPrecheck(accessToken)) {
    throw new Error(buildOperatorPrecheckMessage({ action: "Build-Start", reason: "invalid_role" }));
  }
  if (!trimmedAdminKey && !accessToken) {
    throw new Error("Build-Start blockiert: Lokaler Workflow-Admin-Key oder Supabase-Login-JWT fehlt.");
  }

  const invokeOpts: { body: Record<string, string>; headers?: Record<string, string> } = {
    body: { githubRepo, buildProfile: profile, branch: buildBranch },
    headers: await buildEdgeOwnerAuthHeaders({
      action: "Build-Start",
      userJwt: accessToken,
      adminKey: trimmedAdminKey || null,
      contentType: "application/json",
    }),
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
