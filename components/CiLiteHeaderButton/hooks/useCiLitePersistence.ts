import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { buildPersistCiLiteEntries, readPersistedCiLiteSelection, type PersistedCiLiteSnapshot } from "../../../lib/ciLitePersistence";
import { getBranchHeadSha } from "../../../infra/github/githubService";
import { logger } from "../../../lib/logger";
import { runCleanupTask } from "../../../lib/safeCleanup";
import { WORKFLOW_CI_LITE, type StepState } from "../types";

type UseCiLitePersistenceHydrationParams = {
  githubRepo: string;
  branch: string;
  hasActiveRunContext: boolean;
  setHydratedSnapshot: (snapshot: PersistedCiLiteSnapshot | null) => void;
};

export function useCiLitePersistenceHydration({
  githubRepo,
  branch,
  hasActiveRunContext,
  setHydratedSnapshot,
}: UseCiLitePersistenceHydrationParams) {
  useEffect(() => {
    let cancelled = false;

    if (!githubRepo || !branch) {
      setHydratedSnapshot(null);
      return () => {
        cancelled = true;
      };
    }

    if (hasActiveRunContext) {
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const persisted = await readPersistedCiLiteSelection({
        repoFullName: githubRepo,
        branchName: branch,
        deps: {
          storageGetItem: (key: string) => AsyncStorage.getItem(key),
          readBranchHeadSha: getBranchHeadSha,
        },
      });

      if (!cancelled) {
        setHydratedSnapshot(persisted.snapshot);
      }
    })().catch((error: unknown) => {
      logger.warn("[CiLiteWorkflow] hydrate persisted CI-Lite snapshot failed", { err: error });
      if (!cancelled) setHydratedSnapshot(null);
    });

    return () => {
      cancelled = true;
    };
  }, [branch, githubRepo, hasActiveRunContext, setHydratedSnapshot]);
}

type UseCiLitePersistenceSnapshotParams = {
  workflowRun: {
    id: number;
    status: string;
    conclusion?: string | null;
    head_sha?: string;
  } | null;
  workflowId: string;
  runId: number | null;
  githubRepo: string;
  targetRef: string | null;
  branch: string;
  jobId: string | null;
  stepInfo: { lint: StepState; typecheck: StepState };
  artifactResult: {
    eslint_exit?: number;
    tsc_exit?: number;
    source_commit_sha?: string;
    source_sha?: string;
    github_sha?: string;
  } | null;
};

export function useCiLitePersistenceSnapshot({
  workflowRun,
  workflowId,
  runId,
  githubRepo,
  targetRef,
  branch,
  jobId,
  stepInfo,
  artifactResult,
}: UseCiLitePersistenceSnapshotParams) {
  useEffect(() => {
    if (!workflowRun || workflowId !== WORKFLOW_CI_LITE || workflowRun.status !== "completed") return;
    if (runId == null || workflowRun.id !== runId) return;
    if (!githubRepo || !targetRef || targetRef.trim() !== branch.trim()) return;

    const isSuccess = (workflowRun.conclusion || "").toLowerCase() === "success";
    const lintOk = artifactResult ? artifactResult.eslint_exit === 0 : isSuccess || stepInfo.lint === "success";
    const typeOk = artifactResult ? artifactResult.tsc_exit === 0 : isSuccess || stepInfo.typecheck === "success";
    const sourceCommitSha = String(
      artifactResult?.source_commit_sha || artifactResult?.source_sha || artifactResult?.github_sha || workflowRun?.head_sha || "",
    ).trim();

    void runCleanupTask(
      () =>
        AsyncStorage.multiSet(
          buildPersistCiLiteEntries({
            // Preferred source of truth is the repo/branch-scoped snapshot.
            // The legacy flat keys are mirrored only temporarily for migration compatibility.
            snapshot: {
              repo: githubRepo,
              branch: (targetRef || branch || "").trim(),
              sha: sourceCommitSha,
              runAtMs: Date.now(),
              workflowId,
              jobId,
              runId: workflowRun?.id ?? null,
              conclusion: String(workflowRun?.conclusion || ""),
              lintOk,
              typecheckOk: typeOk,
            },
          }),
        ),
      "[CiLiteWorkflow] persist CI-Lite snapshot failed",
    );
  }, [artifactResult, branch, githubRepo, jobId, runId, stepInfo.lint, stepInfo.typecheck, targetRef, workflowId, workflowRun]);
}
