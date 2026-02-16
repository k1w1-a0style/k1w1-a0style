// shared/types/build.ts
// Central shared build-related types (extracted from lib/buildStatusMapper.ts and lib/supabaseTypes.ts)

export type BuildStatus =
  | 'idle'
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
  };
  raw?: any;
  errorMessage?: string;
  runId?: number | null;
}
