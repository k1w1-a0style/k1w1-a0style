import type { BuildStatus, BuildStatusDetails } from "../shared/types/build";

type BuildSelectionSnapshot = {
  jobId?: string | null;
  repoName?: string | null;
  branch?: string | null;
  buildProfile?: string | null;
};

export type BuildHistoryStatusSnapshot = {
  jobId: string;
  status: BuildStatus;
  htmlUrl: string | null;
  artifactUrl: string | null;
  sourceCommitSha: string | null;
  runId: number | null;
};

type HistoryTraceabilityState = Pick<
  BuildHistoryStatusSnapshot,
  "htmlUrl" | "artifactUrl" | "sourceCommitSha" | "runId"
>;

function resolveNonEmptyString(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function resolveEffectiveHistoryTraceability(params: {
  activeJobId: string;
  details: BuildStatusDetails;
  lastSnapshot: BuildHistoryStatusSnapshot | null;
  currentBuild?: {
    jobId?: string | null;
    urls?: {
      html?: string | null;
      artifacts?: string | null;
    } | null;
    sourceCommitSha?: string | null;
    runId?: number | null;
  } | null;
}): HistoryTraceabilityState {
  const snapshotForJob =
    params.lastSnapshot?.jobId === params.activeJobId ? params.lastSnapshot : null;
  const currentBuildForJob =
    params.currentBuild?.jobId === params.activeJobId ? params.currentBuild : null;

  const nextHtmlUrl = resolveNonEmptyString(params.details.urls?.html);
  const nextArtifactUrl = resolveNonEmptyString(params.details.urls?.artifacts);
  const nextSourceCommitSha = resolveNonEmptyString(params.details.sourceCommitSha);
  const nextRunId = typeof params.details.runId === "number" ? params.details.runId : null;

  return {
    htmlUrl:
      nextHtmlUrl ??
      snapshotForJob?.htmlUrl ??
      resolveNonEmptyString(currentBuildForJob?.urls?.html) ??
      null,
    artifactUrl:
      nextArtifactUrl ??
      snapshotForJob?.artifactUrl ??
      resolveNonEmptyString(currentBuildForJob?.urls?.artifacts) ??
      null,
    sourceCommitSha:
      nextSourceCommitSha ??
      snapshotForJob?.sourceCommitSha ??
      resolveNonEmptyString(currentBuildForJob?.sourceCommitSha) ??
      null,
    runId:
      nextRunId ??
      snapshotForJob?.runId ??
      (typeof currentBuildForJob?.runId === "number" ? currentBuildForJob.runId : null) ??
      null,
  };
}

export const resolveHistoryBuildSelection = (params: {
  activeJobId?: string | null;
  snapshot?: BuildSelectionSnapshot | null;
  currentBuild?: {
    githubRepo?: string | null;
    branch?: string | null;
    buildProfile?: string | null;
  } | null;
}) => {
  const snapshot = params.snapshot;
  const snapshotMatchesJob =
    !!params.activeJobId &&
    !!snapshot?.jobId &&
    snapshot.jobId === params.activeJobId;

  return {
    repoName: snapshotMatchesJob
      ? (snapshot?.repoName ?? undefined)
      : (params.currentBuild?.githubRepo ?? undefined),
    branch: snapshotMatchesJob
      ? (snapshot?.branch ?? undefined)
      : (params.currentBuild?.branch ?? undefined),
    buildProfile: snapshotMatchesJob
      ? (snapshot?.buildProfile ?? undefined)
      : (params.currentBuild?.buildProfile ?? undefined),
  };
};

export const shouldUpdateBuildHistoryStatus = (params: {
  lastSnapshot: BuildHistoryStatusSnapshot | null;
  activeJobId: string;
  status: BuildStatus;
  details: BuildStatusDetails;
  currentBuild?: {
    jobId?: string | null;
    urls?: {
      html?: string | null;
      artifacts?: string | null;
    } | null;
    sourceCommitSha?: string | null;
    runId?: number | null;
  } | null;
}): boolean => {
  const traceability = resolveEffectiveHistoryTraceability({
    activeJobId: params.activeJobId,
    details: params.details,
    lastSnapshot: params.lastSnapshot,
    currentBuild: params.currentBuild,
  });
  return !(
    params.lastSnapshot?.jobId === params.activeJobId &&
    params.lastSnapshot?.status === params.status &&
    params.lastSnapshot?.htmlUrl === traceability.htmlUrl &&
    params.lastSnapshot?.artifactUrl === traceability.artifactUrl &&
    params.lastSnapshot?.sourceCommitSha === traceability.sourceCommitSha &&
    params.lastSnapshot?.runId === traceability.runId
  );
};

export const createBuildHistoryStatusSnapshot = (params: {
  activeJobId: string;
  status: BuildStatus;
  traceability: HistoryTraceabilityState;
}): BuildHistoryStatusSnapshot => ({
  jobId: params.activeJobId,
  status: params.status,
  htmlUrl: params.traceability.htmlUrl,
  artifactUrl: params.traceability.artifactUrl,
  sourceCommitSha: params.traceability.sourceCommitSha,
  runId: params.traceability.runId,
});

export const resolveBuildHistoryTraceability = (params: {
  activeJobId: string;
  details: BuildStatusDetails;
  lastSnapshot: BuildHistoryStatusSnapshot | null;
  currentBuild?: {
    jobId?: string | null;
    urls?: {
      html?: string | null;
      artifacts?: string | null;
    } | null;
    sourceCommitSha?: string | null;
    runId?: number | null;
  } | null;
}): HistoryTraceabilityState => resolveEffectiveHistoryTraceability(params);
