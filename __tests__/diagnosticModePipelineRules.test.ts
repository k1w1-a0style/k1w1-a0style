import { pipelineCheckAppliesToModes } from "../screens/DiagnosticScreen/hooks/useDiagnosticScreen";

describe("diagnostic pipeline mode filtering", () => {
  it("uses recommended mode when no explicit mode is selected", () => {
    expect(
      pipelineCheckAppliesToModes({
        checkId: "repo.easBuildType.preview",
        modesAll: false,
        selectedModes: [],
        recommendedMode: "preview",
      }),
    ).toBe(true);

    expect(
      pipelineCheckAppliesToModes({
        checkId: "repo.easBuildType.production",
        modesAll: false,
        selectedModes: [],
        recommendedMode: "preview",
      }),
    ).toBe(false);
  });

  it("keeps dev-only rules gated behind development mode", () => {
    expect(
      pipelineCheckAppliesToModes({
        checkId: "repo.dep.expoDevClient",
        modesAll: false,
        selectedModes: ["preview"],
        recommendedMode: "preview",
      }),
    ).toBe(false);

    expect(
      pipelineCheckAppliesToModes({
        checkId: "repo.dep.expoDevClient",
        modesAll: false,
        selectedModes: ["development"],
        recommendedMode: "preview",
      }),
    ).toBe(true);
  });
});
