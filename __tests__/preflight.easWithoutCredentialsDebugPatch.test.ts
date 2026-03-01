import { checkEasWithoutCredentialsForDebug } from "../lib/diagnostics/checks/assetsAndFiles";

describe("preflight eas-withoutcredentials-debug", () => {
  it("warns and creates jsonMerge patch for development/preview", () => {
    const result = checkEasWithoutCredentialsForDebug.run([
      {
        path: "eas.json",
        content: JSON.stringify({
          build: {
            development: { android: { buildType: "apk" } },
            preview: { android: { buildType: "apk" } },
          },
        }),
      } as any,
    ], { mode: "eas", profile: "all" });

    expect(result.id).toBe("eas-withoutcredentials-debug");
    expect(result.status).toBe("warn");
    const merge = result.fix?.patch?.jsonMerge?.[0] as any;
    expect(merge?.path).toBe("eas.json");
    expect(merge?.patch?.build?.development?.android?.withoutCredentials).toBe(true);
    expect(merge?.patch?.build?.preview?.android?.withoutCredentials).toBe(true);
  });
});
