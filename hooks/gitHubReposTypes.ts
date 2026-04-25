// hooks/gitHubReposTypes.ts
// Extracted from useGitHubRepos.ts: public type surface.

import type {
  GitHubBranch,
  WorkflowRun,
} from "../infra/github/githubService";

export type { GitHubBranch, WorkflowRun };

export type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch?: string | null;
  description?: string | null;
  updated_at: string;
};

// ============================================
// CALLBACK TYPES
// ============================================
export interface UseGitHubReposCallbacks {
  onLoadError?: (error: string) => void;
  onDeleteError?: (error: string, repo: GitHubRepo) => void;
  onDeleteNoPermission?: (repo: GitHubRepo) => void;
  onRenameError?: (error: string, currentName: string, newName: string) => void;
  onPullError?: (error: string) => void;
  onPullNoFiles?: () => void;
  onNoToken?: () => void;
}
