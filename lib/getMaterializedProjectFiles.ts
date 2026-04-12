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

export const getSourceProjectFiles = (
  projectData: MinimalProjectData | null | undefined,
): ProjectFile[] => (Array.isArray(projectData?.files) ? projectData.files : []);
