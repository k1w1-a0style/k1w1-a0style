import fs from "fs";
import path from "path";

describe("useChatAIFlow hard-timeout wiring invariants", () => {
  const orchestratorFile = path.join(process.cwd(), "hooks/chatAIFlowRequestOrchestrator.ts");
  const requestControllerFile = path.join(process.cwd(), "hooks/chatAIFlow/useChatAIRequestController.ts");
  const timeoutHelperFile = path.join(process.cwd(), "hooks/chatAIFlow/chatAIFlowPureHelpers.ts");
  const requestOrchestratorSource = fs.readFileSync(orchestratorFile, "utf8");
  const requestControllerSource = fs.readFileSync(requestControllerFile, "utf8");
  const timeoutHelperSource = fs.readFileSync(timeoutHelperFile, "utf8");

  it("wires planner/builder/validator/explain through runOrchestratorWithHardTimeout", () => {
    const calls = requestOrchestratorSource.match(/await\s+runOrchestratorWithTimeout\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(4);

    expect(requestOrchestratorSource).toContain("const planRes = await runOrchestratorWithTimeout(");
    expect(requestOrchestratorSource).toContain("ai = await runOrchestratorWithTimeout(");
    expect(requestOrchestratorSource).toContain("for (let attempt = 1; attempt <= BUILDER_RETRY_MAX_ATTEMPTS; attempt += 1)");
    expect(requestOrchestratorSource).toContain("const agentRes = await runOrchestratorWithTimeout(");
    expect(requestOrchestratorSource).toContain("const explainRes = await runOrchestratorWithTimeout(");
  });

  it("keeps raw runOrchestrator call confined to timeout wrapper", () => {
    expect(requestControllerSource).not.toMatch(/await\s+runOrchestrator\(/);
    expect(requestOrchestratorSource).not.toMatch(/await\s+runOrchestrator\(/);
    expect(timeoutHelperSource).toContain("const result = await runOrchestrator(");
  });
});
