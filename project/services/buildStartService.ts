// project/services/buildStartService.ts
// Extracted from ProjectContext.startBuild to keep ProjectContext lean.
// Behavior is intentionally kept the same.

import type { ProjectData, ProjectFile } from "../../contexts/types";

import { CONFIG } from "../../config";
import { ensureSupabaseClient } from "../../lib/supabase";
import {
  getEdgeAdminKey,
  getDefaultBranch,
  pushFilesToRepo,
} from "../../contexts/githubService";

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

async function bestEffortPushToGitHub(opts: {
  githubRepo: string;
  branchHint?: string | null;
  files: ProjectFile[];
}): Promise<string> {
  const { githubRepo, branchHint, files } = opts;

  if (!githubRepo || !githubRepo.includes("/")) {
    throw new Error('Kein GitHub-Repo verbunden. Bitte in "Connections" ein Repo verknuepfen.');
  }

  const [owner, repo] = githubRepo.split("/");
  let branch = typeof branchHint === "string" ? branchHint.trim() : "";

  if (!branch) {
    try {
      branch = (await getDefaultBranch(owner, repo)).trim();
    } catch (err) {
      console.warn("Default-Branch konnte nicht ermittelt werden, fallback auf 'main':", err);
      branch = "main";
    }
  }

  if (!branch) branch = "main";

  if (owner && repo && files?.length) {
    await pushFilesToRepo(owner, repo, files as any, branch);
  }

  return branch;
}

export async function startBuildJob(params: {
  project: ProjectData;
  buildProfile?: string;
}): Promise<StartBuildJobResult> {
  const { project, buildProfile } = params;

  if (!project?.files || project.files.length === 0) {
    throw new Error("Projekt ist leer. Es gibt keine Dateien zum Bauen.");
  }

  const githubRepo = (project.linkedRepo?.trim() || CONFIG.BUILD.GITHUB_REPO).trim();
  const profile = normalizeProfile(buildProfile);

  let buildBranch =
    typeof project.linkedBranch === "string" ? project.linkedBranch.trim() : "";

  try {
    buildBranch = await bestEffortPushToGitHub({
      githubRepo,
      branchHint: buildBranch,
      files: project.files,
    });
  } catch (e) {
    console.warn(
      "Auto-Push nach GitHub fehlgeschlagen. Build nutzt evtl. alten Repo-Stand:",
      e,
    );
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
    "trigger-eas-build",
    invokeOpts,
  );

  if (error) throw error;

  const jobId: string | null =
    typeof (data as any)?.jobId === "string"
      ? (data as any).jobId
      : typeof (data as any)?.job_id === "string"
        ? (data as any).job_id
        : typeof (data as any)?.job?.id === "string"
          ? (data as any).job.id
          : null;

  if (!jobId) {
    throw new Error("trigger-eas-build lieferte keine gueltige Job-ID zurueck.");
  }

  if (!isUuid(jobId)) {
    throw new Error(
      `trigger-eas-build lieferte eine ungueltige Job-ID (UUID erwartet): ${jobId}`,
    );
  }

  return {
    jobId,
    githubRepo,
    branch: buildBranch || "main",
    buildProfile: profile,
  };
}
