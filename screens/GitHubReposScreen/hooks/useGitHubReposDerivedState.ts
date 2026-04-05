import { useCallback, useMemo } from "react";

import type { WorkflowRun } from "../../../hooks/useGitHubRepos";
import type { GitHubRepo } from "../../../hooks/gitHubReposTypes";
import { combineRepos } from "../utils/repos";
import type { RepoFilterType } from "./templateFiles";

export const filterReposForScreen = (params: {
  repos: GitHubRepo[];
  activeRepo: string | null;
  recentRepos: string[];
  searchTerm: string;
  filterType: RepoFilterType;
}): GitHubRepo[] => {
  const term = params.searchTerm.trim().toLowerCase();
  let list = params.repos;

  if (params.filterType === "activeOnly" && params.activeRepo) {
    list = list.filter((r) => r.full_name === params.activeRepo);
  }
  if (params.filterType === "recentOnly") {
    list = list.filter((r) => params.recentRepos.includes(r.full_name));
  }

  if (term) {
    list = list.filter((r) => r.full_name.toLowerCase().includes(term));
  }
  return list;
};

type Deps = {
  repos: GitHubRepo[];
  localRepos: GitHubRepo[];
  activeRepo: string | null;
  recentRepos: string[];
  searchTerm: string;
  filterType: RepoFilterType;
  loadWorkflowRuns: (owner: string, repo: string, perPage?: number) => Promise<WorkflowRun[]>;
};

export function useGitHubReposDerivedState(deps: Deps) {
  const {
    repos,
    localRepos,
    activeRepo,
    recentRepos,
    searchTerm,
    filterType,
    loadWorkflowRuns,
  } = deps;

  const combinedRepos = useMemo(() => combineRepos(repos, localRepos), [repos, localRepos]);

  const activeRepoObj = useMemo(() => {
    if (!activeRepo) return null;
    return combinedRepos.find((r) => r.full_name === activeRepo) ?? null;
  }, [activeRepo, combinedRepos]);

  const filteredRepos = useMemo(
    () =>
      filterReposForScreen({
        repos: combinedRepos,
        activeRepo,
        recentRepos,
        searchTerm,
        filterType,
      }),
    [combinedRepos, activeRepo, recentRepos, searchTerm, filterType],
  );

  const workflowRuns = useCallback(
    async (owner: string, repo: string, perPage?: number): Promise<WorkflowRun[]> => {
      return loadWorkflowRuns(owner, repo, perPage);
    },
    [loadWorkflowRuns],
  );

  return {
    combinedRepos,
    activeRepoObj,
    filteredRepos,
    workflowRuns,
  };
}
