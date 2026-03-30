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
