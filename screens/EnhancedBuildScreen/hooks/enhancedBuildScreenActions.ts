import type { BuildProfile } from "../types";

import { runCleanupTask } from "../../../lib/safeCleanup";

export const persistPreferredBuildProfile = async (params: {
  profile: BuildProfile;
  setPreferredBuildProfile?: (profile: BuildProfile) => Promise<void>;
}): Promise<void> => {
  if (!params.setPreferredBuildProfile) return;
  await params.setPreferredBuildProfile(params.profile);
};

export const refreshBuildScreenData = async (params: {
  fetchRuns?: (() => Promise<void>) | null;
  refreshHistory: () => Promise<void>;
  refreshPreconditions: () => Promise<void>;
}): Promise<void> => {
  if (typeof params.fetchRuns === "function") {
    await runCleanupTask(
      () => params.fetchRuns?.() ?? Promise.resolve(),
      "[EnhancedBuildScreen] workflow runs refresh failed",
    );
  }
  await runCleanupTask(
    () => params.refreshHistory(),
    "[EnhancedBuildScreen] background history refresh failed",
  );
  await runCleanupTask(
    () => params.refreshPreconditions(),
    "[EnhancedBuildScreen] background preconditions refresh failed",
  );
};
