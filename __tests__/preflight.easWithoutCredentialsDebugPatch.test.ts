import { checkEasWithoutCredentialsForDebug } from "../lib/diagnostics/checks/assetsAndFiles";
import { makeProjectFile } from "./helpers/preflightTestHelpers";

describe("preflight eas-withoutcredentials-debug", () => {
  it("warns and creates jsonMerge patch for development/preview", () => {
    const result = checkEasWithoutCredentialsForDebug.run([
      makeProjectFile("eas.json", JSON.stringify({
        build: {
          development: { android: { buildType: "apk" } },
          preview: { android: { buildType: "apk" } },
        },
      })),
    ], { mode: "eas", profile: "all" });

    expect(result.id).toBe("eas-withoutcredentials-debug");
    expect(result.status).toBe("warn");
    const merge = result.fix?.patch?.jsonMerge?.[0];
    expect(merge?.path).toBe("eas.json");
    expect((merge?.patch as { build?: { development?: { android?: { withoutCredentials?: boolean } }; preview?: { android?: { withoutCredentials?: boolean } } } } | undefined)?.build?.development?.android?.withoutCredentials).toBe(true);
    expect((merge?.patch as { build?: { development?: { android?: { withoutCredentials?: boolean } }; preview?: { android?: { withoutCredentials?: boolean } } } } | undefined)?.build?.preview?.android?.withoutCredentials).toBe(true);
  });
});
