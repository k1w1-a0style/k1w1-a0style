import { githubLimiter } from "./rateLimit";
import { getGitHubToken } from "./tokenStore";
import { fetchGitHub } from "./utils";
import { githubApiUrl } from "../../shared/constants/github";
import { JsonRecord, readGitHubMessage, readJsonRecordSafe } from "./githubResponseHelpers";

export const requireGitHubAuthHeaders = async (): Promise<Record<string, string>> => {
  const token = await getGitHubToken();
  if (!token) throw new Error("GitHub token fehlt.");
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
  };
};

export const fetchGitHubRecord = async (
  path: string,
  headers: Record<string, string>,
): Promise<{ resp: Response; json: JsonRecord }> => {
  await githubLimiter.checkLimit();
  const resp = await fetchGitHub(githubApiUrl(path), { headers });
  const json = await readJsonRecordSafe(resp);
  return { resp, json };
};

export const checkGitHubWorkflowRateLimit = async (): Promise<void> => {
  await githubLimiter.checkLimit();
};

export const throwCommonWorkflowError = (
  status: number,
  json: JsonRecord,
  fallbackMessage: string,
  errorMap: Partial<Record<number, string>>,
): never => {
  const mapped = errorMap[status];
  if (mapped) throw new Error(mapped);
  throw new Error(readGitHubMessage(json) || fallbackMessage);
};
