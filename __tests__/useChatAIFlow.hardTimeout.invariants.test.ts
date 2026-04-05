import fs from "fs";
import path from "path";

describe("useChatAIFlow hard-timeout wiring invariants", () => {
  const file = path.join(process.cwd(), "hooks/useChatAIFlow.ts");
  const requestOrchestratorFile = path.join(process.cwd(), "hooks/chatAIFlowRequestOrchestrator.ts");
  const source = fs.readFileSync(file, "utf8");
  const requestOrchestratorSource = fs.readFileSync(requestOrchestratorFile, "utf8");

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
    const processStart = source.indexOf("const processAIRequest = useCallback(");
    expect(processStart).toBeGreaterThan(-1);

    const processBody = source.slice(processStart);
    expect(processBody).not.toMatch(/await\s+runOrchestrator\(/);
  });
});
