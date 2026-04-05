import { splitFullName } from "../utils/repos";

export const buildRepoBranchContextKey = (
  repo: string | null | undefined,
  branch: string | null | undefined,
): string | null => {
  const normalizedRepo = String(repo ?? "").trim();
  const normalizedBranch = String(branch ?? "").trim();
  return normalizedRepo && normalizedBranch ? `${normalizedRepo}@@${normalizedBranch}` : null;
};

export const getEasLinkNeutralMessage = (contextKey: string | null): string => {
  return contextKey
    ? "Pruefstatus fuer die aktuelle Repo-/Branch-Auswahl noch nicht geladen."
    : "Repo oder Branch sind noch nicht ausgewaehlt.";
};

type RepoParts = { owner: string; repo: string };

export const resolveSyncStatusPrecheck = (params: {
  activeRepo: string | null | undefined;
  activeBranch: string | null | undefined;
}): {
  status: "missing_repo" | "invalid_repo" | "missing_branch" | "ready";
  repoParts: RepoParts | null;
  branch: string;
} => {
  const repo = String(params.activeRepo ?? "").trim();
  if (!repo) {
    return { status: "missing_repo", repoParts: null, branch: "" };
  }

  const repoParts = splitFullName(repo);
  if (!repoParts) {
    return { status: "invalid_repo", repoParts: null, branch: "" };
  }

  const branch = String(params.activeBranch ?? "").trim();
  if (!branch) {
    return { status: "missing_branch", repoParts, branch: "" };
  }

  return { status: "ready", repoParts, branch };
};


export const buildPushSelectionFromLocalFiles = (params: {
  localFiles: Array<{ path: string }>;
}): Record<string, boolean> => {
  const initial: Record<string, boolean> = {};
  for (const file of params.localFiles) {
    const path = String(file.path ?? "").trim();
    if (!path) continue;
    initial[path] = true;
  }
  return initial;
};

export const buildPushSelectionForWantedPaths = (params: {
  localFiles: Array<{ path: string }>;
  wantedPaths: string[];
}): { selection: Record<string, boolean>; pickedCount: number } => {
  const wanted = new Set(
    (params.wantedPaths || []).map((path) => String(path ?? "").trim()).filter(Boolean),
  );

  const selection: Record<string, boolean> = {};
  for (const file of params.localFiles) {
    const path = String(file.path ?? "").trim();
    if (!path) continue;
    if (!wanted.size || wanted.has(path)) {
      selection[path] = true;
    }
  }

  const pickedCount = Object.values(selection).filter(Boolean).length;
  return { selection, pickedCount };
};
