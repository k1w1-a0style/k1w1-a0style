import type { ProjectFile } from "../shared/types/project";
import { makeProjectFile } from "./helpers/diagnosticTestHelpers";
import { checkEntryPoint } from "../lib/diagnostics/checks/packageAndEntry";
import { checkExpoConfig, checkSdkConsistency, checkEasProfiles } from "../lib/diagnostics/checks/configAndProfiles";
import { checkReactNativeCompatibility, checkQualityScriptsDeps } from "../lib/diagnostics/checks/qualityAndCompat";

describe("diagnostic checks JSON readers", () => {
  it("checkEntryPoint falls back to index.js for non-object package.json", () => {
    const files: ProjectFile[] = [makeProjectFile("package.json", "[]")];
    const result = checkEntryPoint.run(files, { mode: "eas", profile: "all" });

    expect(result.status).toBe("fail");
    expect(result.fix?.patch?.jsonMerge?.[0]?.path).toBe("package.json");
  });

  it("checkEasProfiles warns for missing profile when eas.json is an object without matching build profile", () => {
    const files: ProjectFile[] = [
      makeProjectFile("eas.json", JSON.stringify({ build: { preview: { android: { buildType: "apk" } } } })),
    ];
    const result = checkEasProfiles.run(files, { mode: "eas", profile: "production" });

    expect(result.status).toBe("warn");
    expect(result.message).toContain("build.production");
  });

  it("checkExpoConfig fails when expo object is missing", () => {
    const files: ProjectFile[] = [makeProjectFile("app.json", JSON.stringify({ notExpo: true }))];
    const result = checkExpoConfig.run(files, { mode: "eas", profile: "all" });

    expect(result.status).toBe("fail");
    expect(result.message).toContain('"expo"');
  });

  it("checkSdkConsistency warns when expo is missing from object-shaped package.json", () => {
    const files: ProjectFile[] = [
      makeProjectFile("package.json", JSON.stringify({ dependencies: { react: "18.3.1" } })),
    ];
    const result = checkSdkConsistency.run(files, { mode: "eas", profile: "all" });

    expect(result.status).toBe("warn");
    expect(result.message).toContain("expo dependency fehlt");
  });

  it("checkReactNativeCompatibility treats non-object package.json as pass", () => {
    const files: ProjectFile[] = [makeProjectFile("package.json", "[]")];
    const result = checkReactNativeCompatibility.run(files, { mode: "eas", profile: "all" });

    expect(result.status).toBe("pass");
  });

  it("checkQualityScriptsDeps warns when scripts imply missing quality deps", () => {
    const files: ProjectFile[] = [
      makeProjectFile("package.json", JSON.stringify({ scripts: { typecheck: "tsc --noEmit", lint: "eslint ." } })),
    ];
    const result = checkQualityScriptsDeps.run(files, { mode: "eas", profile: "all" });

    expect(result.status).toBe("warn");
    expect(result.message).toContain("typescript");
    expect(result.message).toContain("eslint");
  });
});
