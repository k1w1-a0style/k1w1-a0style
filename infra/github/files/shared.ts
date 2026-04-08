import { githubApiUrl } from "../../../shared/constants/github";
import { getDefaultBranch } from "../repos";

export const readJsonSafe = async <T>(response: Response): Promise<T | null> => {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

export const readJsonOrThrowWithTextFallback = async (
  response: Response,
  fallbackPrefix: string,
): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    const text = await response.text();
    throw new Error(`${fallbackPrefix} (${response.status}): ${text}`);
  }
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const pickGitHubMessage = (value: unknown): string | null => {
  if (!isObjectRecord(value)) return null;
  const message = value.message;
  return typeof message === "string" && message.trim() ? message : null;
};

export const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message.trim() ? error.message : fallback;

export const resolveTargetBranch = async (owner: string, repo: string, branch?: string) => {
  let targetBranch = typeof branch === "string" ? branch.trim() : "";

  if (!targetBranch) {
    targetBranch = (await getDefaultBranch(owner, repo)).trim();
  }

  if (!targetBranch) {
    throw new Error("Explicit branch/ref is required.");
  }
  return targetBranch;
};

export const buildContentsUrl = (owner: string, repo: string, path: string, branch?: string): string => {
  return githubApiUrl(
    `/repos/${owner}/${repo}/contents/${path}${branch ? `?ref=${encodeURIComponent(branch)}` : ""}`,
  );
};
