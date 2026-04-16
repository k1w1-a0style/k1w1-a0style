import { materializeProjectFiles } from "./projectMaterializer";
import type { ProjectData, ProjectFile } from "../shared/types/project";

type MinimalProjectData = {
  files?: ProjectData["files"] | null;
  name?: string;
  slug?: string;
  packageName?: string;
};

export const getMaterializedProjectFiles = (
  projectData: MinimalProjectData | null | undefined,
): ProjectFile[] => {
  const files = getSourceProjectFiles(projectData);
  return materializeProjectFiles(files, {
    name: projectData?.name,
    slug: projectData?.slug ?? projectData?.name,
    packageName: projectData?.packageName,
  });
};

/**
 * Canonical operator-facing file view.
 *
 * IMPORTANT:
 * - source/raw files (`projectData.files`) are user-edited inputs.
 * - canonical ops files are the materialized build/sync truth used for operator-critical flows.
 *
 * Keep operator paths on this API so they do not silently drift back to raw files.
 */
export const getCanonicalProjectFilesForOps = (
  projectData: MinimalProjectData | null | undefined,
): ProjectFile[] => getMaterializedProjectFiles(projectData);

export const getSourceProjectFiles = (
  projectData: MinimalProjectData | null | undefined,
): ProjectFile[] => (Array.isArray(projectData?.files) ? projectData.files : []);
