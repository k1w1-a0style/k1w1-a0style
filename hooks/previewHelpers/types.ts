import type { PreviewFiles, PreviewResponse } from "../../types/preview";

export type ProjectFile = { path?: string; content?: string };

export interface PreviewState {
  isCreating: boolean;
  lastCreatedAt: number | null;
  error: string | null;
  remoteFailure: string | null;
  fileCount: number;
  totalSize: number;
  skippedCount: number;
}

export type PreviewResult = {
  url: string | null;
  html: string | null;
  expiresAt: string | null;
  source: "supabase" | "local";
};

export type PreviewAttemptMode = "supabase" | "local" | null | undefined;
export type PreviewPhase = "idle" | "creating" | "loading" | "ready" | "error";
export type PreviewRemoteUrlStatus = "missing" | "invalid" | "insecure" | "trusted";
export type PreviewDisplayKind = "loading" | "remote_ready" | "fallback_active" | "unavailable" | "failed";

export interface PreviewDisplayState {
  kind: PreviewDisplayKind;
  tone: "neutral" | "ok" | "warning" | "error";
  statusText: string;
  detailText: string | null;
  badgeText: string | null;
}

export interface ResolvePreviewDisplayStateOptions {
  phase: PreviewPhase;
  previewKind: "supabase" | "local" | null;
  previewSourceType: "url" | "html" | null;
  remoteUrlStatus: PreviewRemoteUrlStatus;
  hasExpiredRemoteUrl: boolean;
  remoteFailure: string | null;
  stateError: string | null;
  webError: string | null;
  transientLocalPreviewNotice: string | null;
}

export type PreviewInvokePayload = {
  projectId?: string;
  name: string;
  files: PreviewFiles;
  dependencies: Record<string, string>;
  meta: Record<string, unknown>;
};

export type PreviewInvokeResponse = PreviewResponse;
