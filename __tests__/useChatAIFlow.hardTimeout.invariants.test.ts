import fs from "fs";
import path from "path";

describe("useChatAIFlow hard-timeout wiring invariants", () => {
  const file = path.join(process.cwd(), "hooks/useChatAIFlow.ts");
  const source = fs.readFileSync(file, "utf8");

  it("wires planner/builder/validator/explain through runOrchestratorWithHardTimeout", () => {
    const calls = source.match(/await\s+runOrchestratorWithHardTimeout\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(5);

    expect(source).toContain("const planRes = await runOrchestratorWithHardTimeout(");
    expect(source).toContain("let ai: OrchestratorResult | null = await runOrchestratorWithHardTimeout(");
    expect(source).toContain("ai = await runOrchestratorWithHardTimeout(");
    expect(source).toContain("const agentRes = await runOrchestratorWithHardTimeout(");
    expect(source).toContain("const explainRes = await runOrchestratorWithHardTimeout(");
  });

  it("keeps raw runOrchestrator call confined to timeout wrapper", () => {
    const processStart = source.indexOf("const processAIRequest = useCallback(");
    expect(processStart).toBeGreaterThan(-1);

    const processBody = source.slice(processStart);
    expect(processBody).not.toMatch(/await\s+runOrchestrator\(/);
  });
});
