import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { startBuildJob } from "../../project/services/buildStartService";
import { useBuildStatus } from "../../hooks/useBuildStatus";
import type { BuildStatus } from "../../shared/types/build";
import { logger } from "../../lib/logger";
import { addBuildToHistory, updateBuildInHistory } from "../../lib/buildHistoryStorage";
import {
  createBuildErrorState,
  createBuildPollingAbortState,
  createBuildQueuedStateAfterStart,
  createBuildQueuedStateForStart,
  resolveBuildHistoryWarningMessage,
  resolveBuildStartContext,
  resolveBuildStartErrorMessage,
  shouldSyncCurrentBuildFromPoll,
  type BuildSelectionSnapshot,
} from "../projectContextBuildHelpers";
import {
  mergeBuildPollIntoCurrentBuild,
  resolveBuildHistoryPollUpdate,
  type CurrentBuildState,
} from "../projectContextStateHelpers";
import type { ProjectBuildControllerInput } from "./projectContext.contracts";

export function useProjectBuildController({ projectData }: ProjectBuildControllerInput) {
  const [currentBuild, setCurrentBuild] = useState<CurrentBuildState | null>(null);
  const currentBuildRef = useRef<CurrentBuildState | null>(null);
  currentBuildRef.current = currentBuild;
  const activeBuildSelectionRef = useRef<BuildSelectionSnapshot | null>(null);

  const activeJobId = currentBuild?.jobId ?? null;
  const buildPoll = useBuildStatus(activeJobId, {
    onMaxErrors: (lastError: unknown) => {
      setCurrentBuild((prev) =>
        createBuildPollingAbortState({
          previous: prev,
          lastError,
          nowIso: new Date().toISOString(),
        }),
      );
    },
  });

  const lastHistoryStatusRef = useRef<{ jobId: string; status: BuildStatus } | null>(null);
  const runBuildHistoryBestEffort = useCallback(
    (
      mode: "update" | "insert",
      operation: () => Promise<void>,
    ) => {
      operation().catch((historyError: unknown) => {
        logger.warn(resolveBuildHistoryWarningMessage(mode), { error: historyError });
      });
    },
    [],
  );

  useEffect(() => {
    if (!shouldSyncCurrentBuildFromPoll({ activeJobId }) || !activeJobId) return;

    const nowIso = new Date().toISOString();

    setCurrentBuild((prev) =>
      mergeBuildPollIntoCurrentBuild({
        previous: prev,
        activeJobId,
        details: buildPoll.details,
        status: buildPoll.status,
        lastError: buildPoll.lastError,
        nowIso,
      }),
    );
  }, [activeJobId, buildPoll.details, buildPoll.lastError, buildPoll.status]);

  useEffect(() => {
    const pollDetails = buildPoll.details;
    const nextHistoryUpdate = resolveBuildHistoryPollUpdate({
      activeJobId,
      details: pollDetails,
      status: buildPoll.status,
      lastSnapshot: lastHistoryStatusRef.current,
      selectionSnapshot: activeBuildSelectionRef.current,
      currentBuild: currentBuildRef.current,
    });
    if (!nextHistoryUpdate || !activeJobId || !pollDetails) return;

    lastHistoryStatusRef.current = nextHistoryUpdate.nextSnapshot;

    runBuildHistoryBestEffort("update", () =>
      updateBuildInHistory(activeJobId, nextHistoryUpdate.update),
    );
  }, [activeJobId, buildPoll.details, buildPoll.status, runBuildHistoryBestEffort]);

  const startBuild = useCallback(
    async (buildProfile?: string) => {
      try {
        // Invariant contract marker: "Kein GitHub-Repo verknüpft."
        const buildStartContext = resolveBuildStartContext({
          project: projectData,
          requestedBuildProfile: buildProfile,
        });
        const pd = buildStartContext.project;
        const githubRepo = buildStartContext.githubRepo;
        const profile = buildStartContext.buildProfile;

        const startedAt = new Date().toISOString();
        const buildBranch = (pd.linkedBranch ?? "").trim();
        activeBuildSelectionRef.current = {
          jobId: null,
          repoName: githubRepo,
          branch: buildBranch,
          buildProfile: profile,
        };
        setCurrentBuild(
          createBuildQueuedStateForStart({
            githubRepo,
            branch: buildBranch,
            buildProfile: profile,
            startedAt,
          }),
        );

        const started = await startBuildJob({
          project: pd,
          buildProfile: profile,
        });

        const jobId = started.jobId;
        const githubRepoResolved = started.githubRepo;
        const branchResolved = started.branch;
        activeBuildSelectionRef.current = {
          jobId,
          repoName: githubRepoResolved,
          branch: branchResolved,
          buildProfile: profile,
        };

        setCurrentBuild((prev) =>
          createBuildQueuedStateAfterStart({
            previous: prev,
            jobId,
            githubRepo: githubRepoResolved,
            branch: branchResolved,
            buildProfile: profile,
            nowIso: new Date().toISOString(),
          }),
        );

        runBuildHistoryBestEffort("insert", () =>
          addBuildToHistory({
            id: uuidv4(),
            jobId,
            repoName: githubRepoResolved,
            branch: branchResolved,
            status: "queued",
            startedAt,
            buildProfile: profile,
          }),
        );

      } catch (e: unknown) {
        setCurrentBuild(
          createBuildErrorState({
            message: resolveBuildStartErrorMessage(e),
            nowIso: new Date().toISOString(),
          }),
        );
        throw e;
      }
    },
    [projectData, runBuildHistoryBestEffort],
  );

  return {
    currentBuild,
    startBuild,
  };
}
