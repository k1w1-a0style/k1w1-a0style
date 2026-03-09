import type { ProjectData } from "../../shared/types/project";

export type RepoBranchSelection = {
  repo: string;
  branch: string;
  repoLine: string;
  source: "project" | "context" | "none";
};

/**
 * Resolve repo/branch from one source at a time.
 *
 * Rules:
 * - If projectData.linkedRepo exists, the project selection wins as a pair.
 * - We never mix project repo with GitHubContext branch.
 * - We never invent a default branch here.
 * - GitHubContext is only a fallback if the project selection is empty.
 */
export function resolveRepoBranchSelection(params: {
  projectData?: ProjectData | null;
  activeRepo?: string | null;
  activeBranch?: string | null;
}): RepoBranchSelection {
  const projectRepo = String(params.projectData?.linkedRepo ?? "").trim();
  const projectBranch = String(params.projectData?.linkedBranch ?? "").trim();
  const contextRepo = String(params.activeRepo ?? "").trim();
  const contextBranch = String(params.activeBranch ?? "").trim();

  if (projectRepo) {
    return {
      repo: projectRepo,
      branch: projectBranch,
      repoLine: projectRepo ? `${projectRepo}${projectBranch ? ` (${projectBranch})` : ""}` : "",
      source: "project",
    };
  }

  if (contextRepo) {
    return {
      repo: contextRepo,
      branch: contextBranch,
      repoLine: contextRepo ? `${contextRepo}${contextBranch ? ` (${contextBranch})` : ""}` : "",
      source: "context",
    };
  }

  return {
    repo: "",
    branch: "",
    repoLine: "",
    source: "none",
  };
}
