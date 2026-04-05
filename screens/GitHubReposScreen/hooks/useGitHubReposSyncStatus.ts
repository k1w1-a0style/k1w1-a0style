import { useCallback, useEffect, useRef, useState } from "react";

import type { MutableRefObject } from "react";
import { compareLocalFilesWithRepo } from "../../../infra/github/githubService";
import { resolveSyncStatusPrecheck } from "./useGitHubReposScreenHelpers";
import type { ProjectFile } from "../../../shared/types/project";

export type SyncStatus = {
  checking: boolean;
  modified: number;
  localOnly: number;
  remoteOnly: number;
  skipped: number;
  error: number;
  checkedAt: number | null;
};

export const EMPTY_SYNC_STATUS: SyncStatus = {
  checking: false,
  modified: 0,
  localOnly: 0,
  remoteOnly: 0,
  skipped: 0,
  error: 0,
  checkedAt: null,
};

type Deps = {
  activeRepo: string | null;
  activeBranch: string | null;
  normalizedLocalFiles: ProjectFile[];
  isMountedRef: MutableRefObject<boolean>;
};

export function useGitHubReposSyncStatus(deps: Deps) {
  const { activeRepo, activeBranch, normalizedLocalFiles, isMountedRef } = deps;

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(EMPTY_SYNC_STATUS);
  const syncStatusRunRef = useRef(0);

  const refreshSyncStatus = useCallback(async () => {
    const runId = ++syncStatusRunRef.current;
    const commitSyncStatus = (next: SyncStatus) => {
      if (!isMountedRef.current) return;
      if (runId !== syncStatusRunRef.current) return;
      setSyncStatus(next);
    };

    const precheck = resolveSyncStatusPrecheck({
      activeRepo,
      activeBranch,
    });

    if (precheck.status === "missing_repo") {
      commitSyncStatus({ ...EMPTY_SYNC_STATUS, checkedAt: Date.now() });
      return;
    }
    if (precheck.status === "invalid_repo") {
      commitSyncStatus({ ...EMPTY_SYNC_STATUS, checkedAt: Date.now(), error: 1 });
      return;
    }
    if (precheck.status === "missing_branch") {
      commitSyncStatus({ ...EMPTY_SYNC_STATUS, checkedAt: Date.now(), error: 1 });
      return;
    }

    const parsed = precheck.repoParts;
    const branch = precheck.branch;
    if (!parsed) return;

    commitSyncStatus({ ...EMPTY_SYNC_STATUS, checking: true });

    try {
      const stats = await compareLocalFilesWithRepo({
        owner: parsed.owner,
        repo: parsed.repo,
        branch,
        localFiles: normalizedLocalFiles,
        maxLocalFiles: 40,
      });
      commitSyncStatus({ checking: false, ...stats, checkedAt: Date.now() });
    } catch {
      commitSyncStatus({ ...EMPTY_SYNC_STATUS, checking: false, error: 1, checkedAt: Date.now() });
    }
  }, [activeRepo, activeBranch, normalizedLocalFiles, isMountedRef]);

  useEffect(() => {
    if (!activeRepo) {
      setSyncStatus(EMPTY_SYNC_STATUS);
      return;
    }
    void refreshSyncStatus();
  }, [activeRepo, activeBranch, refreshSyncStatus]);

  return {
    syncStatus,
    refreshSyncStatus,
  };
}
