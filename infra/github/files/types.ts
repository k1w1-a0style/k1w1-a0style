export type RepoBlobEntry = {
  path: string;
  sha: string;
};

export type GitHubMessagePayload = { message?: string };
export type GitHubContentFilePayload = { sha?: string; content?: string; encoding?: string };
export type GitHubBranchPayload = { commit?: { sha?: string } };
export type GitHubCommitPayload = { sha?: string; tree?: { sha?: string } };
export type GitHubTreeEntryPayload = { type?: string; path?: string; sha?: string };
export type GitHubTreePayload = { tree?: GitHubTreeEntryPayload[] };
export type GitHubCreateFileBody = {
  message: string;
  content: string;
  branch: string;
  sha?: string;
};
