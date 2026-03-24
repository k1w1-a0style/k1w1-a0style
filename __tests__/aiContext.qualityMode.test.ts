import {
  getModeKeyForQualityMode,
  resolveProviderModeForQualityMode,
} from "../contexts/AIContext/helpers";

describe("AIContext quality mode mapping", () => {
  test("maps quality/review to provider quality defaults", () => {
    expect(getModeKeyForQualityMode("quality")).toBe("quality");
    expect(getModeKeyForQualityMode("review")).toBe("quality");
    expect(resolveProviderModeForQualityMode("openai", "quality")).toBe("gpt-4o");
    expect(resolveProviderModeForQualityMode("anthropic", "review")).toBe(
      "claude-sonnet-4-20250514",
    );
  });

  test("maps speed/balanced to provider speed defaults", () => {
    expect(getModeKeyForQualityMode("speed")).toBe("speed");
    expect(getModeKeyForQualityMode("balanced")).toBe("speed");
    expect(resolveProviderModeForQualityMode("openai", "speed")).toBe("gpt-4o-mini");
    expect(resolveProviderModeForQualityMode("gemini", "balanced")).toBe(
      "gemini-2.5-flash-lite",
    );
  });
});
