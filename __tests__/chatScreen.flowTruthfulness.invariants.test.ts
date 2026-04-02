import fs from "fs";
import path from "path";

describe("ChatScreen flow truthfulness invariants", () => {
  const screenFile = path.join(process.cwd(), "screens/ChatScreen/hooks/useChatScreen.ts");
  const screenSource = fs.readFileSync(screenFile, "utf8");

  it("clears the draft only after handleSendWithMeta resolves successfully", () => {
    expect(screenSource).toContain("const ok = await handleSendWithMeta(rawInput, currentInput);");
    expect(screenSource).toContain("if (!ok) return;");
    expect(screenSource).toContain('setTextInput((current) => (current === priorTextInput ? \"\" : current));');
    expect(screenSource).toContain("current === priorSelectedFileAsset ? null : current");
  });
});
