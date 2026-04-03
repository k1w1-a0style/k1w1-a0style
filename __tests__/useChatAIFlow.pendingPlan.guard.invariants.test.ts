import fs from "node:fs";
import path from "node:path";

describe("useChatAIFlow pending plan guard invariants", () => {
  const file = path.join(process.cwd(), "hooks/useChatAIFlow.ts");
  const src = fs.readFileSync(file, "utf8");

  it("keeps advice-mode guard coupled to proceed intent", () => {
    expect(src).toContain('if (currentPlan.mode === "advice" && !wantsProceed)');
    expect(src).toContain('lower === "weiter"');
    expect(src).toContain('lower === "mach weiter"');
  });

  it("keeps scout-mode guard coupled to explicit direct-build confirmation", () => {
    expect(src).toContain('if (currentPlan.mode === "scout" && !wantsDirectBuild)');
    expect(src).toContain('lower === "direkt build"');
    expect(src).toContain("Scout-Modus aktiv");
  });

  it("uses the same direct-build helper for scout handoff and metrics", () => {
    expect(src).toContain("isDirectBuildCommand(normalizedIntentReply)");
    expect(src).toContain("isDirectBuildCommand(lower)");
  });
});
