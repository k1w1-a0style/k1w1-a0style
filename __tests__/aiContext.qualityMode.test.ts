import {
  getModeKeyForQualityMode,
  resolveProviderModeForQualityMode,
} from "../contexts/AIContext/helpers";

describe("AIContext quality mode mapping", () => {
  test("maps quality/review to provider quality defaults", () => {
    expect(getModeKeyForQualityMode("quality")).toBe("quality");
    expect(getModeKeyForQualityMode("review")).toBe("quality");
    expect(resolveProviderModeForQualityMode("openai", "quality")).toBe("gpt-5.4-pro");
    expect(resolveProviderModeForQualityMode("anthropic", "review")).toBe(
      "claude-4-opus-202502",
    );
    expect(resolveProviderModeForQualityMode("gemini", "quality")).toBe("gemini-3.1-pro");
  });

  test("maps speed/balanced to provider speed defaults", () => {
    expect(getModeKeyForQualityMode("speed")).toBe("speed");
    expect(getModeKeyForQualityMode("balanced")).toBe("speed");
    expect(resolveProviderModeForQualityMode("openai", "speed")).toBe("gpt-5.4-mini");
    expect(resolveProviderModeForQualityMode("gemini", "balanced")).toBe(
      "gemini-3.1-flash-lite",
    );
  });
});
