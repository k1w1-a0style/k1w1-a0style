export type LocalFile = { path: string; content: string };

export type DiffStatus = "same" | "modified" | "localOnly" | "remoteOnly" | "skipped" | "error";

export type DiffItem = {
  path: string;
  status: DiffStatus;
  detail?: string;
};

export type PreviewCacheEntry = {
  status: DiffStatus;
  local: string;
  remote: string;
  diff: string;
};

export type LocalRemoteDiffSectionProps = {
  activeRepo: string | null;
  activeBranch: string | null;
  projectFiles: LocalFile[];
  onPushSelected?: (paths: string[]) => void;
};

export type DiffSummary = {
  same: number;
  modified: number;
  localOnly: number;
  remoteOnly: number;
  skipped: number;
  error: number;
  total: number;
  isPartial: boolean;
  countsAreLowerBounds: boolean;
  localComparedCountsAreLowerBounds: boolean;
  remoteOnlyCountIsLowerBound: boolean;
  partialReason: string | null;
};

export type DiffPreviewState = {
  open: boolean;
  path: string;
  status: DiffStatus;
  loading: boolean;
  local: string;
  remote: string;
  diff: string;
};
