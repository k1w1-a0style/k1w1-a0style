import { resolveBuildStatusPresentation } from "../screens/EnhancedBuildScreen/hooks/buildScreenHelpers";

describe("buildScreenHelpers", () => {
  it("maps building progress to percentage label", () => {
    expect(resolveBuildStatusPresentation({ status: "building", progress: 0.42 })).toEqual({
      statusEmoji: "🔨",
      statusLabel: "42%",
    });
  });

  it("maps non-building statuses to uppercase labels", () => {
    expect(resolveBuildStatusPresentation({ status: "queued", progress: 0.42 })).toEqual({
      statusEmoji: "⏳",
      statusLabel: "QUEUED",
    });

    expect(resolveBuildStatusPresentation({ status: "success" })).toEqual({
      statusEmoji: "✅",
      statusLabel: "SUCCESS",
    });
  });
});
