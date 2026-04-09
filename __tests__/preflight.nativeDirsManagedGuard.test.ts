import { checkNativeDirsManagedGuard } from "../lib/diagnostics/checks/assetsAndFiles";
import { makeProjectFile } from "./helpers/preflightTestHelpers";

describe("preflight native-dirs-managed-guard", () => {
  it("warns when android dir exists but build.gradle is missing (windows style path)", () => {
    const result = checkNativeDirsManagedGuard.run(
      [makeProjectFile("android\\app\\src\\main\\AndroidManifest.xml", "manifest")],
      { mode: "eas", profile: "all" },
    );

    expect(result.id).toBe("native-dirs-managed-guard");
    expect(result.status).toBe("warn");
    expect(result.details?.join("\n")).toMatch(/android\/app\/build\.gradle fehlt/i);
  });

  it("passes when android dir and build.gradle are present", () => {
    const result = checkNativeDirsManagedGuard.run(
      [
        makeProjectFile("android/app/src/main/AndroidManifest.xml", "manifest"),
        makeProjectFile("android/app/build.gradle", "apply plugin"),
      ],
      { mode: "eas", profile: "all" },
    );

    expect(result.id).toBe("native-dirs-managed-guard");
    expect(result.status).toBe("pass");
  });
});
