import fs from "node:fs";
import path from "node:path";

describe("connectionsScreen flow guards invariants", () => {
  const file = path.join(process.cwd(), "screens/ConnectionsScreen/hooks/useConnectionsScreen.ts");
  const src = fs.readFileSync(file, "utf8");

  it("uses a busy guard helper for save/test actions", () => {
    expect(src).toContain("const withBusyGuard = useCallback");
    expect(src).toContain("Ein anderer Save/Test-Lauf ist noch aktiv.");
  });

  it("does not persist Expo token as side effect in testExpo", () => {
    const start = src.indexOf("const testExpo = useCallback(async () => {");
    const end = src.indexOf("const testSupabase = useCallback(async () => {");
    const block = src.slice(start, end);
    expect(block).not.toContain("saveExpoToken(");
  });

  it("does not set optimistic eas ok true right after workflow trigger", () => {
    const start = src.indexOf("const onLinkExisting = useCallback(async () => {");
    const end = src.indexOf("const onCreateAndLink = useCallback(async () => {");
    const block = src.slice(start, end);
    expect(block).toContain("setEasOk(false)");
    expect(block).not.toContain("setEasOk(true)");
  });
});
