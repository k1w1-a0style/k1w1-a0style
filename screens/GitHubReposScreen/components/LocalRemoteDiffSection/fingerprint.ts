import { normalizeRepoPath } from "../../../../infra/github/utils";
import { LocalFile } from "./types";

function hashText(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

export function buildLocalFilesFingerprint(files: LocalFile[]) {
  if (!files.length) return "local:empty";
  return files
    .map((file) => {
      const path = normalizeRepoPath(String(file.path || ""));
      const content = String(file.content ?? "");
      return `${path}:${content.length}:${hashText(content)}`;
    })
    .sort()
    .join("|");
}
