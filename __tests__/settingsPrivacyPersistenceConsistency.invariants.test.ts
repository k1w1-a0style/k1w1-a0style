import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("settings privacy persistence consistency invariants", () => {
  test("rolls persisted privacy flag back when scrub fails after a successful off-write", () => {
    const src = read("screens/SettingsScreen/hooks/useSettingsScreen.ts");
    expect(src).toContain("let persistenceWritten = false;");
    expect(src).toContain("if (persistenceWritten && !v)");
    expect(src).toContain("await setChatHistoryPersistence(previous);");
    expect(src).toContain("setPersistChatHistory(previous);");
  });
});
