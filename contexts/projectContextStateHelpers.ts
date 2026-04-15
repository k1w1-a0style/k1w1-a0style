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
};

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
}): boolean => {
  return !(
    params.lastSnapshot?.jobId === params.activeJobId &&
    params.lastSnapshot?.status === params.status
  );
};

export const createBuildHistoryStatusSnapshot = (params: {
  activeJobId: string;
  status: BuildStatus;
}): BuildHistoryStatusSnapshot => ({
  jobId: params.activeJobId,
  status: params.status,
});

export const resolveBuildHistoryPollUpdate = (params: {
  activeJobId: string | null;
  details: BuildStatusDetails | null;
  status: BuildStatus;
  lastSnapshot: BuildHistoryStatusSnapshot | null;
  selectionSnapshot?: BuildSelectionSnapshot | null;
  currentBuild?: {
    githubRepo?: string | null;
    branch?: string | null;
    buildProfile?: string | null;
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
      };
    }
  | null => {
  if (!params.activeJobId || !params.details) {
    return null;
  }

  if (
    !shouldUpdateBuildHistoryStatus({
      lastSnapshot: params.lastSnapshot,
      activeJobId: params.activeJobId,
      status: params.status,
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
    }),
    update: {
      jobId: params.activeJobId,
      status: params.status,
      branch: selection.branch,
      buildProfile: selection.buildProfile,
      repoName: selection.repoName,
      htmlUrl: params.details.urls?.html ?? null,
      artifactUrl: params.details.urls?.artifacts ?? null,
      sourceCommitSha: params.details.sourceCommitSha ?? null,
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
  const urls = params.details?.urls;

  return {
    ...base,
    status: params.status,
    jobId: params.activeJobId,
    runId: params.details?.runId ?? base.runId ?? null,
    sourceCommitSha: params.details?.sourceCommitSha ?? base.sourceCommitSha ?? null,
    urls: {
      html: urls?.html ?? base.urls?.html ?? null,
      artifacts: urls?.artifacts ?? base.urls?.artifacts ?? null,
      buildUrl: urls?.buildUrl ?? base.urls?.buildUrl ?? null,
    },
    message: getBuildStatusMessage({
      status: params.status,
      lastError: params.lastError,
    }),
    lastUpdatedAt: params.nowIso,
    completedAt: ["success", "failed", "error"].includes(params.status)
      ? params.nowIso
      : base.completedAt,
  };
};
