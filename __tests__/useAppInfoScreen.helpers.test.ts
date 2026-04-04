import {
  countMessages,
  getApiKeysCount,
  getAssetsStatusFromProjectFiles,
  getIconPreviewFromProjectFiles,
  getPackageNameFromProjectFiles,
  toProjectFiles,
} from "../screens/AppInfoScreen/hooks/useAppInfoScreen.helpers";

describe("useAppInfoScreen helper contracts", () => {
  test("toProjectFiles filters malformed entries", () => {
    const result = toProjectFiles([
      { path: "package.json", content: '{"name":"ok"}' },
      { path: "assets/icon.png" },
      null,
      "x",
    ]);

    expect(result).toEqual([{ path: "package.json", content: '{"name":"ok"}' }]);
  });

  test("package/icon/assets derivation keeps expected fallbacks", () => {
    const base64 = "A".repeat(120);
    const projectFiles = [
      { path: "package.json", content: JSON.stringify({ name: "demo.app" }) },
      { path: "assets/icon.png", content: `data:image/png;base64,${base64}` },
      { path: "assets/adaptive-icon.png", content: base64 },
      { path: "assets/splash.png", content: "short" },
      { path: "assets/favicon.png", content: base64 },
    ];

    expect(getPackageNameFromProjectFiles(projectFiles)).toBe("demo.app");
    expect(getIconPreviewFromProjectFiles(projectFiles)).toBe(`data:image/png;base64,${base64}`);
    expect(getAssetsStatusFromProjectFiles(projectFiles)).toEqual({
      icon: true,
      adaptiveIcon: true,
      splash: false,
      favicon: true,
    });

    expect(getPackageNameFromProjectFiles([{ path: "package.json", content: "{" }])).toBe("meine-app");
    expect(getIconPreviewFromProjectFiles([{ path: "assets/icon.png", content: "invalid" }])).toBeNull();
  });

  test("message/api key counters stay deterministic", () => {
    expect(countMessages({ chatHistory: [1, 2, 3], messages: [1] })).toBe(3);
    expect(countMessages({ messages: [1, 2] })).toBe(2);
    expect(countMessages(null)).toBe(0);

    expect(
      getApiKeysCount({
        groq: ["a"],
        gemini: [],
        openai: ["x", "y"],
        anthropic: [],
        huggingface: ["z"],
      }),
    ).toEqual({
      groq: 1,
      gemini: 0,
      openai: 2,
      anthropic: 0,
      huggingface: 1,
    });
  });
});
