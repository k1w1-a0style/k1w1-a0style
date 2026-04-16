import type { BuildStatus, BuildStatusDetails } from "../shared/types/build";
import type { ChatMessage } from "../shared/types/chat";
import type { TemplateId } from "../shared/types/project";
import { trimChatHistory } from "../infra/storage/persistenceHelpers";
import type { ProjectContextProps } from "./projectTypes";

export const CHAT_HISTORY_RETENTION_FALLBACK = 200;

export const appendChatMessageWithRetention = (
  history: ChatMessage[],
  message: ChatMessage,
  limit: number,
): ChatMessage[] => trimChatHistory([...(history || []), message], limit);

export const sanitizeChatRetentionLimit = (limit: number): number => {
  if (!Number.isFinite(limit) || limit < 0) return CHAT_HISTORY_RETENTION_FALLBACK;
  return Math.floor(limit);
};

export const shouldApplyHydratedRetention = (
  didSetRuntimeRetention: boolean,
): boolean => !didSetRuntimeRetention;

export const resolveProjectContextErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
};

export const resolveTemplateMode = (
  templateId: string | null | undefined,
): TemplateId => {
  const value = String(templateId ?? "").trim();
  return value ? (value as TemplateId) : "auto";
};

const isBuildProfile = (
  profile: unknown,
): profile is "development" | "preview" | "production" => {
  return (
    profile === "development" ||
    profile === "preview" ||
    profile === "production"
  );
};

export const resolveLinkedBranchForRepoSelection = (params: {
  previousRepo?: string | null;
  nextRepo?: string | null;
  previousBranch?: string | null;
  nextBranch?: string | null;
}): string | null => {
  const previousRepo = (params.previousRepo ?? "").trim();
  const nextRepo = (params.nextRepo ?? "").trim();

  if (typeof params.nextBranch !== "undefined") {
    return params.nextBranch ?? null;
  }

  // Prevent stale branch carry-over when the user changed repo but did not pick a new branch yet.
  if (previousRepo !== nextRepo) {
    return null;
  }

  return params.previousBranch ?? null;
};

export const resolveBuildProfileForStart = (params: {
  requestedProfile?: string;
  preferredProfile?: string | null;
}): "development" | "preview" | "production" => {
  if (isBuildProfile(params.requestedProfile)) return params.requestedProfile;
  if (isBuildProfile(params.preferredProfile)) return params.preferredProfile;
  return "preview";
};

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

export const resolveBuildHistoryPollUpdate = (params: {
  activeJobId: string | null;
  details: BuildStatusDetails | null;
  status: BuildStatus;
  lastSnapshot: BuildHistoryStatusSnapshot | null;
  selectionSnapshot?: BuildSelectionSnapshot | null;
  currentBuild?: {
    jobId?: string | null;
    githubRepo?: string | null;
    branch?: string | null;
    buildProfile?: string | null;
    urls?: {
      html?: string | null;
      artifacts?: string | null;
    } | null;
    sourceCommitSha?: string | null;
    runId?: number | null;
  } | null;
}):
  | {
      nextSnapshot: BuildHistoryStatusSnapshot;
      update: {
        jobId: string;
        status: BuildStatus;
        branch: string | undefined;
        buildProfile: string | undefined;
        repoName: string | undefined;
        htmlUrl: string | null;
        artifactUrl: string | null;
        sourceCommitSha: string | null;
        runId: number | null;
      };
    }
  | null => {
  if (!params.activeJobId || !params.details) {
    return null;
  }
  const traceability = resolveEffectiveHistoryTraceability({
    activeJobId: params.activeJobId,
    details: params.details,
    lastSnapshot: params.lastSnapshot,
    currentBuild: params.currentBuild,
  });

  if (
    !shouldUpdateBuildHistoryStatus({
      lastSnapshot: params.lastSnapshot,
      activeJobId: params.activeJobId,
      status: params.status,
      details: params.details,
      currentBuild: params.currentBuild,
    })
  ) {
    return null;
  }

  const selection = resolveHistoryBuildSelection({
    activeJobId: params.activeJobId,
    snapshot: params.selectionSnapshot,
    currentBuild: params.currentBuild,
  });

  return {
    nextSnapshot: createBuildHistoryStatusSnapshot({
      activeJobId: params.activeJobId,
      status: params.status,
      traceability,
    }),
    update: {
      jobId: params.activeJobId,
      status: params.status,
      branch: selection.branch,
      buildProfile: selection.buildProfile,
      repoName: selection.repoName,
      htmlUrl: traceability.htmlUrl,
      artifactUrl: traceability.artifactUrl,
      sourceCommitSha: traceability.sourceCommitSha,
      runId: traceability.runId,
    },
  };
};

export const getValidContextMessages = (
  history: ChatMessage[] | null | undefined,
): ChatMessage[] => {
  return (history ?? []).filter(
    (msg) => msg && (msg.id || msg.timestamp) && typeof msg.content === "string",
  );
};

export type CurrentBuildState = NonNullable<ProjectContextProps["currentBuild"]>;

export const getBuildStatusMessage = (params: {
  status: BuildStatus;
  lastError?: string | null;
}): string => {
  const mapped = params.status;

  return mapped === "queued"
    ? "⏳ Build ist in der Warteschlange…"
    : mapped === "starting"
      ? "🧭 Build-Start wird vorbereitet…"
      : mapped === "building"
        ? "🔨 Build läuft…"
        : mapped === "success"
          ? "✅ Build erfolgreich!"
          : mapped === "failed"
            ? "❌ Build fehlgeschlagen."
            : mapped === "error"
              ? `⚠️ Fehler beim Status-Abruf${params.lastError ? ": " + params.lastError : "."}`
              : "⏸️ Kein aktiver Build.";
};

export const mergeBuildPollIntoCurrentBuild = (params: {
  previous: CurrentBuildState | null;
  activeJobId: string;
  details: BuildStatusDetails | null;
  status: BuildStatus;
  lastError?: string | null;
  nowIso: string;
}): CurrentBuildState => {
  const base: CurrentBuildState = params.previous ?? { status: "idle" };
  const shouldKeepPreviousTransiently =
    params.status === "idle" &&
    !params.details &&
    (base.status === "starting" || base.status === "queued");
  const nextStatus: BuildStatus = shouldKeepPreviousTransiently ? base.status : params.status;
  const urls = params.details?.urls;

  return {
    ...base,
    status: nextStatus,
    jobId: params.activeJobId,
    runId: params.details?.runId ?? base.runId ?? null,
    sourceCommitSha: params.details?.sourceCommitSha ?? base.sourceCommitSha ?? null,
    urls: {
      html: urls?.html ?? base.urls?.html ?? null,
      artifacts: urls?.artifacts ?? base.urls?.artifacts ?? null,
      buildUrl: urls?.buildUrl ?? base.urls?.buildUrl ?? null,
    },
    message: getBuildStatusMessage({
      status: nextStatus,
      lastError: params.lastError,
    }),
    lastUpdatedAt: params.nowIso,
    completedAt: ["success", "failed", "error"].includes(nextStatus)
      ? params.nowIso
      : base.completedAt,
  };
};
