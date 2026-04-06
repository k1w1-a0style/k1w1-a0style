import type { BuildStatus, BuildStatusDetails } from "../shared/types/build";
import type { ProjectData } from "../shared/types/project";
import type { ProjectContextProps } from "./projectTypes";
import { resolveBuildProfileForStart, type CurrentBuildState } from "./projectContextStateHelpers";

export type BuildSelectionSnapshot = {
  jobId?: string | null;
  repoName?: string | null;
  branch?: string | null;
  buildProfile?: string | null;
};

export const createBuildPollingAbortState = (params: {
  previous: CurrentBuildState | null;
  lastError: unknown;
  nowIso: string;
}): CurrentBuildState => {
  const base: CurrentBuildState = params.previous ?? { status: "error" };
  return {
    ...base,
    status: "error",
    message: `🛑 Polling abgebrochen (zu viele Fehler). Letzter Fehler: ${params.lastError}`,
    lastUpdatedAt: params.nowIso,
  };
};

export const createBuildQueuedStateForStart = (params: {
  githubRepo: string;
  branch: string;
  buildProfile: string;
  startedAt: string;
}): NonNullable<ProjectContextProps["currentBuild"]> => ({
  status: "queued",
  message: "🚀 Build wird gestartet…",
  jobId: null,
  githubRepo: params.githubRepo,
  branch: params.branch,
  buildProfile: params.buildProfile,
  startedAt: params.startedAt,
  lastUpdatedAt: params.startedAt,
});

export const createBuildQueuedStateAfterStart = (params: {
  previous: CurrentBuildState | null;
  jobId: string;
  githubRepo: string;
  branch: string;
  buildProfile: string;
  nowIso: string;
}): CurrentBuildState => ({
  ...(params.previous ?? { status: "queued" }),
  status: "queued",
  message: "✅ Build gestartet. Warte auf GitHub Actions…",
  jobId: params.jobId,
  githubRepo: params.githubRepo,
  branch: params.branch,
  buildProfile: params.buildProfile,
  lastUpdatedAt: params.nowIso,
});

export const createBuildErrorState = (params: {
  message: string;
  nowIso: string;
}): CurrentBuildState => ({
  status: "error",
  message: params.message,
  lastUpdatedAt: params.nowIso,
});

export const resolveBuildStartErrorMessage = (
  error: unknown,
  fallback = "Build konnte nicht gestartet werden.",
): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return fallback;
};

export const resolveBuildHistoryWarningMessage = (
  mode: "update" | "insert",
): string => {
  return mode === "update"
    ? "⚠️ Build-Historie konnte nicht aktualisiert werden"
    : "⚠️ Build-Historie konnte nicht gespeichert werden";
};

export const resolveBuildStartContext = (params: {
  project: ProjectData | null;
  requestedBuildProfile?: string;
}): {
  project: ProjectData;
  githubRepo: string;
  branch: string;
  buildProfile: "development" | "preview" | "production";
} => {
  const project = params.project;
  if (!project?.files || project.files.length === 0) {
    throw new Error("Projekt ist leer. Es gibt keine Dateien zum Bauen.");
  }

  const githubRepo = (project.linkedRepo?.trim() || "").trim();
  if (!githubRepo) {
    throw new Error(
      "Kein GitHub-Repo verknüpft. Bitte zuerst in GitHub Repos ein Repo auswählen und verknüpfen.",
    );
  }

  return {
    project,
    githubRepo,
    branch: (project.linkedBranch ?? "").trim(),
    buildProfile: resolveBuildProfileForStart({
      requestedProfile: params.requestedBuildProfile,
      preferredProfile: project.preferredBuildProfile,
    }),
  };
};

export const shouldSyncCurrentBuildFromPoll = (params: {
  activeJobId: string | null;
}): params is { activeJobId: string } => Boolean(params.activeJobId);

export const shouldUpdateHistoryFromPoll = (params: {
  activeJobId: string | null;
  details: BuildStatusDetails | null;
  status: BuildStatus;
}): params is { activeJobId: string; details: BuildStatusDetails; status: BuildStatus } => {
  return Boolean(params.activeJobId && params.details);
};
