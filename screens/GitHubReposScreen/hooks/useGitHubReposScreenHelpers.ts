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
