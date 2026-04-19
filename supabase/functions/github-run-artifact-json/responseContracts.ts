import { errorResponse } from "../_shared/cors.ts";

type ArtifactMeta = {
  id: number;
  name: string;
};

type FileNotFoundInArtifactZipParams = {
  req: Request;
  filePath: string;
  runId: number;
  artifact: ArtifactMeta;
  availableFiles: string[];
};

export function fileNotFoundInArtifactZipResponse(
  params: FileNotFoundInArtifactZipParams,
): Response {
  const { req, filePath, runId, artifact, availableFiles } = params;
  return errorResponse(`File not found in artifact zip: ${filePath}`, req, 404, {
    runId,
    artifactId: artifact.id,
    artifactName: artifact.name,
    availableFiles: availableFiles.slice(0, 50),
  }, {
    noStore: true,
  });
}
