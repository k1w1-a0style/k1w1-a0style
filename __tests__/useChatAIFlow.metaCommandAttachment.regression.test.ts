import fs from "node:fs";
import path from "node:path";

describe("useChatAIFlow meta command + attachment regression", () => {
  const file = path.join(process.cwd(), "hooks/useChatAIFlow.ts");
  const src = fs.readFileSync(file, "utf8");

  it("routes meta commands against raw user input before AI attachment notice input", () => {
    expect(src).toContain("async (\n      rawInput: string,\n      aiInput: string = rawInput,");
    expect(src).toContain("const userContent = rawInput.trim();");
    expect(src).toContain("const metaResult = handleMetaCommand(userContent, projectFilesRef.current);");
  });

  it("keeps attachment notice scoped to the AI request payload", () => {
    expect(src).toContain("const aiContent = aiInput.trim();");
    expect(src).toContain("await processAIRequest(aiContent || userContent, false, false);");
  });
});
