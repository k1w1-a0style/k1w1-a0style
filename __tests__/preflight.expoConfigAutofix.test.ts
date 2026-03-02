import { checkExpoConfig } from "../lib/diagnostics/checks/configAndProfiles";

describe("preflight expo-config-validation autofix", () => {
  it("emits minimal app.json upsert fix when expo config is missing", () => {
    const result = checkExpoConfig.run([], { mode: "eas", profile: "all" });

    expect(result.id).toBe("expo-config-validation");
    expect(result.status).toBe("fail");
    expect(result.fix?.patch?.upsert?.[0]?.path).toBe("app.json");

    const appJson = JSON.parse(result.fix?.patch?.upsert?.[0]?.content || "{}");
    expect(appJson.expo.name).toBe("CHANGE_ME");
    expect(appJson.expo.slug).toBe("change-me");
    expect(appJson.expo.version).toBe("1.0.0");
    expect(appJson.expo.android.package).toBe("com.change.me");
  });
});
