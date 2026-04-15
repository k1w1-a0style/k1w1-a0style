// shared/types/build.ts
// Central shared build-related types (extracted from lib/buildStatusMapper.ts and lib/supabaseTypes.ts)

export type BuildStatus =
  | 'idle'
  | 'starting'
  | 'queued'
  | 'building'
  | 'success'
  | 'failed'
  | 'error';

export interface BuildStatusDetails {
  jobId: string;
  status: BuildStatus;
  urls?: {
    html?: string | null;
    artifacts?: string | null;
    /** Optional: direct artifact/build download URL (UI convenience) */
    buildUrl?: string | null;
  };
  raw?: unknown;
  errorMessage?: string;
  runId?: number | null;
  /** Exact commit SHA that the workflow checked out for this build job. */
  sourceCommitSha?: string | null;
}

/**
 * Persisted build history entry (local storage / UI history).
 * Kept in shared/types so the UI + lib storage use the exact same shape.
 */
export interface BuildHistoryEntry {
  id: string;
  jobId: string;
  repoName: string;
  branch?: string;
  status: BuildStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  buildProfile?: string;
  artifactUrl?: string | null;
  htmlUrl?: string | null;
  errorMessage?: string;
  /** Exact commit SHA that produced this history entry. */
  sourceCommitSha?: string | null;
}
