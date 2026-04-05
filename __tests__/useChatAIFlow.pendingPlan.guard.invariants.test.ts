import fs from "node:fs";
import path from "node:path";

describe("useChatAIFlow pending plan guard invariants", () => {
  const file = path.join(process.cwd(), "hooks/useChatAIFlow.ts");
  const handoffHelpersFile = path.join(process.cwd(), "hooks/chatAIFlowPendingPlanHandoff.ts");
  const routingHelpersFile = path.join(process.cwd(), "hooks/chatAIFlowInputRoutingHelpers.ts");
  const src = fs.readFileSync(file, "utf8");
  const handoffHelpersSrc = fs.readFileSync(handoffHelpersFile, "utf8");
  const routingHelpersSrc = fs.readFileSync(routingHelpersFile, "utf8");

  it("keeps advice-mode guard coupled to proceed intent", () => {
    expect(handoffHelpersSrc).toContain("const wantsProceed = isProceedCommand(lower);");
    expect(handoffHelpersSrc).toContain("const holdDecision = shouldHoldPendingPlan({");
    expect(routingHelpersSrc).toContain('if (mode === "advice" && !wantsProceed)');
    expect(routingHelpersSrc).toContain('normalizedInput === "weiter"');
    expect(routingHelpersSrc).toContain('normalizedInput === "mach weiter"');
  });

  it("keeps scout-mode guard coupled to explicit direct-build confirmation", () => {
    expect(handoffHelpersSrc).toContain("const wantsDirectBuild = isDirectBuildCommand(lower);");
    expect(routingHelpersSrc).toContain('if (mode === "scout" && !wantsDirectBuild)');
    expect(routingHelpersSrc).toContain("Scout-Modus aktiv");
  });

  it("uses the same direct-build helper for scout handoff and metrics", () => {
    expect(src).toContain("isDirectBuildCommand(normalizedIntentReply)");
    expect(src).toContain("resolvePendingPlanHandoff({");
    expect(src).toContain("isDirectBuildCommand,");
  });
});
