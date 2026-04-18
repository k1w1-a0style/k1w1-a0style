import fs from "node:fs";
import path from "node:path";

describe("useChatAIFlow pending plan guard invariants", () => {
  const orchestratorFile = path.join(process.cwd(), "hooks/useChatAIFlow.ts");
  const requestControllerFile = path.join(process.cwd(), "hooks/chatAIFlow/useChatAIRequestController.ts");
  const handoffHelpersFile = path.join(process.cwd(), "hooks/chatAIFlowPendingPlanHandoff.ts");
  const routingHelpersFile = path.join(process.cwd(), "hooks/chatAIFlowInputRoutingHelpers.ts");
  const orchestratorSrc = fs.readFileSync(orchestratorFile, "utf8");
  const requestControllerSrc = fs.readFileSync(requestControllerFile, "utf8");
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

  it("keeps staged-mode guard coupled to block-1/proceed confirmation", () => {
    expect(routingHelpersSrc).toContain('if (mode === "staged" && !wantsProceed && !wantsDirectBuild)');
    expect(routingHelpersSrc).toContain('normalizedInput === "block 1"');
    expect(routingHelpersSrc).toContain("Stufenmodus aktiv");
  });

  it("uses the same direct-build helper for scout handoff and metrics", () => {
    expect(requestControllerSrc).toContain("isDirectBuildCommand(normalizedIntentReply)");
    expect(orchestratorSrc).toContain("resolvePendingPlanHandoff({");
    expect(orchestratorSrc).toContain("isDirectBuildCommand,");
  });
});
