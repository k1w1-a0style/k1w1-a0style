import fs from "node:fs";
import path from "node:path";

describe("useChatAIFlow meta command + attachment regression", () => {
  const file = path.join(process.cwd(), "hooks/useChatAIFlow.ts");
  const src = fs.readFileSync(file, "utf8");

  it("routes meta commands against raw user input before AI attachment notice input", () => {
    expect(src).toContain("async (\n      rawInput: string,\n      aiInput: string = rawInput,");
    expect(src).toContain("const { userContent, candidateInput } = getNormalizedSendInputs(rawInput, aiInput);");
    expect(src).toContain("if (!userContent && !candidateInput) return false;");
    expect(src).toContain("const metaResult = userContent");
    expect(src).toContain("handleMetaCommand(userContent, projectFilesRef.current)");
  });

  it("keeps attachment notice scoped to the AI request payload", () => {
    expect(src).toContain("sanitizedUserContent || sanitizedAiContent");
    expect(src).toContain("const ok = await processAIRequest(sanitizedAiContent, false, false);");
  });

  it("keeps attachment-only follow-up details alive in pending-plan handoff", () => {
    expect(src).toContain("const combined = buildPendingPlanCombinedRequest({");
    expect(src).toContain("sanitizedAiContent,");
    expect(src).toContain("wantsProceed,");
  });
});
