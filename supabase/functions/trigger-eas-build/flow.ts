import { buildDispatchFailurePatch, resolveDispatchRef } from "../_shared/buildJobConsistency.ts";

export type TriggerBuildFlowInput = {
  githubRepo: string;
  buildProfile: "development" | "preview" | "production";
  branch: string;
};

export type TriggerBuildFlowDeps = {
  resolveCommitSha: (githubRepo: string, branch: string) => Promise<string | null>;
  insertBuildJob: (row: {
    github_repo: string;
    build_profile: string;
    branch: string;
    source_commit_sha: string | null;
  }) => Promise<{ id: number }>;
  dispatchBuild: (params: {
    githubRepo: string;
    payload: Record<string, unknown>;
  }) => Promise<{ ok: boolean; status: number; bodyText: string }>;
  patchBuildJobOnDispatchFailure: (id: number, patch: Record<string, unknown>) => Promise<void>;
};

export async function runTriggerBuildFlow(
  input: TriggerBuildFlowInput,
  deps: TriggerBuildFlowDeps,
): Promise<
  | {
      ok: true;
      jobId: number;
      sourceCommitSha: string | null;
      payload: Record<string, unknown>;
    }
  | {
      ok: false;
      jobId: number;
      sourceCommitSha: string | null;
      status: number;
      bodyText: string;
    }
> {
  const sourceCommitSha = await deps.resolveCommitSha(input.githubRepo, input.branch);
  const inserted = await deps.insertBuildJob({
    github_repo: input.githubRepo,
    build_profile: input.buildProfile,
    branch: input.branch,
    source_commit_sha: sourceCommitSha,
  });

  const payload = {
    event_type: "trigger-eas-build",
    client_payload: {
      github_repo: input.githubRepo,
      repo: input.githubRepo,
      branch: input.branch,
      ref: resolveDispatchRef(input.branch, sourceCommitSha),
      build_profile: input.buildProfile,
      buildProfile: input.buildProfile,
      job_id: inserted.id,
      source_commit_sha: sourceCommitSha,
    },
  };

  const dispatch = await deps.dispatchBuild({
    githubRepo: input.githubRepo,
    payload,
  });

  if (!dispatch.ok) {
    await deps.patchBuildJobOnDispatchFailure(
      inserted.id,
      buildDispatchFailurePatch({ statusCode: dispatch.status, sourceCommitSha }),
    );
    return {
      ok: false,
      jobId: inserted.id,
      sourceCommitSha,
      status: dispatch.status,
      bodyText: dispatch.bodyText,
    };
  }

  return {
    ok: true,
    jobId: inserted.id,
    sourceCommitSha,
    payload,
  };
}
