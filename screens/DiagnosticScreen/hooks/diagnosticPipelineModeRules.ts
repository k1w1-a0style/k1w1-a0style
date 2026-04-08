import type { BuildMode } from "../../../components/diagnostics/ModeSelector";

export function pipelineCheckAppliesToModes(params: {
  checkId: string;
  modesAll: boolean;
  selectedModes: BuildMode[];
  recommendedMode: BuildMode;
}): boolean {
  const { checkId, modesAll, selectedModes, recommendedMode } = params;
  if (modesAll) return true;

  const enabled = new Set<BuildMode>(
    selectedModes.length ? selectedModes : [recommendedMode],
  );

  const isFor = (p: "development" | "preview" | "production") => {
    if (checkId.endsWith(`.${p}`)) return true;
    if (checkId.includes(`.${p}.`)) return true;
    if (checkId.includes(`easProfile.${p}`)) return true;
    return false;
  };

  const devOnly =
    checkId === "repo.easDevelopmentCoherent" ||
    checkId === "repo.easEnableDevClientFlow" ||
    checkId === "repo.dep.expoDevClient" ||
    checkId === "repo.dep.expoDevClient.read";

  if (devOnly) return enabled.has("development");
  if (isFor("development")) return enabled.has("development");
  if (isFor("preview")) return enabled.has("preview");
  if (isFor("production")) return enabled.has("production");
  return true;
}
