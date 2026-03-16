import { parseRetentionLimitInput } from "../screens/SettingsScreen/hooks/settingsHelpers";

describe("parseRetentionLimitInput", () => {
  it("rejects empty input instead of coercing to zero", () => {
    expect(parseRetentionLimitInput("")).toBeNull();
    expect(parseRetentionLimitInput("   ")).toBeNull();
  });

  it("accepts and floors non-negative numeric input", () => {
    expect(parseRetentionLimitInput("0")).toBe(0);
    expect(parseRetentionLimitInput("42.9")).toBe(42);
  });
});
