import fs from "node:fs";
import path from "node:path";
import { shouldAttemptPlannerStage } from "../hooks/chatAIFlowRequestPipeline";

describe("chatAIFlowRequestPipeline", () => {
  it("keeps planner-stage guard fail-closed for autofix, force-builder and pending-plan", () => {
    expect(shouldAttemptPlannerStage({ isAutoFix: false, forceBuilder: false, hasPendingPlan: false })).toBe(true);
    expect(shouldAttemptPlannerStage({ isAutoFix: true, forceBuilder: false, hasPendingPlan: false })).toBe(false);
    expect(shouldAttemptPlannerStage({ isAutoFix: false, forceBuilder: true, hasPendingPlan: false })).toBe(false);
    expect(shouldAttemptPlannerStage({ isAutoFix: false, forceBuilder: false, hasPendingPlan: true })).toBe(false);
  });

  it("keeps useChatAIFlow delegating request orchestration to executeChatRequestPipeline", () => {
    const hookFile = path.join(process.cwd(), "hooks/useChatAIFlow.ts");
    const source = fs.readFileSync(hookFile, "utf8");

    expect(source).toContain("const pipelineResult = await executeChatRequestPipeline({");
    expect(source).toContain("if (pipelineResult.kind === \"confirmation_required\")");
    expect(source).toContain("if (pipelineResult.kind === \"planner_preview\")");
    expect(source).toContain("simulateStreaming(pipelineResult.summaryText");
  });
});
