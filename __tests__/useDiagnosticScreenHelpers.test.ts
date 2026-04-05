import {
  buildDiagnosticSelectionScope,
  resolveDiagnosticFocusedProfiles,
} from "../screens/DiagnosticScreen/hooks/useDiagnosticScreenHelpers";

describe("useDiagnosticScreenHelpers", () => {
  it("builds selection scope only when repo and branch are both present", () => {
    expect(buildDiagnosticSelectionScope(" Owner/Repo ", " main ")).toBe("owner/repo::main");
    expect(buildDiagnosticSelectionScope("", "main")).toBeNull();
    expect(buildDiagnosticSelectionScope("owner/repo", "")).toBeNull();
  });

  it("resolves focused profiles from advanced mode flags", () => {
    expect(
      resolveDiagnosticFocusedProfiles({
        modesAll: true,
        selectedModes: [],
        recommendedMode: "preview",
      }),
    ).toEqual(["development", "preview", "production"]);

    expect(
      resolveDiagnosticFocusedProfiles({
        modesAll: false,
        selectedModes: ["production"],
        recommendedMode: "preview",
      }),
    ).toEqual(["production"]);

    expect(
      resolveDiagnosticFocusedProfiles({
        modesAll: false,
        selectedModes: [],
        recommendedMode: "preview",
      }),
    ).toEqual(["preview"]);
  });
});
