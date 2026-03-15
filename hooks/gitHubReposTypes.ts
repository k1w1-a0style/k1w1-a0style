// hooks/gitHubReposTypes.ts
// Extracted from useGitHubRepos.ts: types and helpers.

// hooks/useGitHubRepos.ts - Custom hook for GitHub repository management
import { useState, useCallback } from "react";
import { Buffer } from "buffer";

import { fetchWithBackoff } from "../lib/retryWithBackoff";
import { githubApiUrl } from "../shared/constants/github";
import type { ProjectFile } from "../shared/types/project";
import { logger } from "../lib/logger";
import {
  getBranches as apiBranches,
  getAllWorkflowRuns as apiWorkflowRuns,
  getDefaultBranch as apiDefaultBranch,
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

export const encodePathSegments = (path: string) =>
  path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
