import type { BuildMode } from "../../../components/diagnostics/ModeSelector";

export const buildDiagnosticSelectionScope = (
  linkedRepo: string | null | undefined,
  linkedBranch: string | null | undefined,
): string | null => {
  const repoScope = String(linkedRepo ?? "").trim().toLowerCase();
  const branchScope = String(linkedBranch ?? "").trim();
  return repoScope && branchScope ? `${repoScope}::${branchScope}` : null;
};

export const resolveDiagnosticFocusedProfiles = (params: {
  modesAll: boolean;
  selectedModes: BuildMode[];
  recommendedMode: BuildMode;
}): Array<"development" | "preview" | "production"> => {
  if (params.modesAll) {
    return ["development", "preview", "production"];
  }

  const selected = params.selectedModes.length
    ? params.selectedModes
    : [params.recommendedMode];

  return selected as Array<"development" | "preview" | "production">;
};
