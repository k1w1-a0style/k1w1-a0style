import fs from "node:fs";
import path from "node:path";

describe("useChatAIFlow validator/explain communication invariants", () => {
  const flowFile = path.join(process.cwd(), "hooks/useChatAIFlow.ts");
  const flowSrc = fs.readFileSync(flowFile, "utf8");
  const pipelineFile = path.join(process.cwd(), "hooks/chatAIFlowRequestPipeline.ts");
  const pipelineSrc = fs.readFileSync(pipelineFile, "utf8");
  const helperFile = path.join(process.cwd(), "hooks/chatAIFlowStageHelpers.ts");
  const helperSrc = fs.readFileSync(helperFile, "utf8");
  const noticeMessageHelpersFile = path.join(process.cwd(), "hooks/chatAIFlowNoticeMessageHelpers.ts");
  const noticeMessageHelpersSrc = fs.readFileSync(noticeMessageHelpersFile, "utf8");

  it("surfaces validator fallback warnings instead of only logging", () => {
    expect(pipelineSrc).toContain("addValidatorWarning: (validatorStateForMessage) => {");
    expect(pipelineSrc).toContain("getValidatorFallbackWarning");
    expect(flowSrc).toContain("buildSystemMessage(message, { validatorWarning: true })");

    expect(helperSrc).toContain("Validator war nur advisory und konnte die Builder-Dateien diesmal nicht nachschärfen");
    expect(helperSrc).toContain("Validator war nur advisory und ist fehlgeschlagen");
  });

  it("keeps explain fallback user-visible when explain call fails", () => {
    expect(flowSrc).toContain("buildSystemMessage(getExplainFallbackNoticeText(), { explainWarning: true })");
    expect(flowSrc).toContain("getExplainFallbackNoticeText()");
    expect(noticeMessageHelpersSrc).toContain("Konnte die Kurz-Erklärung für die Änderungen nicht erzeugen");
  });
});
