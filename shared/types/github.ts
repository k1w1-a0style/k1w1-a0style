// shared/types/github.ts
// Central shared GitHub-related types

export interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string };
  private?: boolean;
}

export interface GitHubBranch {
  name: string;
  commit: { sha: string };
}
