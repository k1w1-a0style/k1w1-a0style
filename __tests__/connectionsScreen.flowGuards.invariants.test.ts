import fs from "node:fs";
import path from "node:path";

describe("connectionsScreen flow guards invariants", () => {
  const file = path.join(process.cwd(), "screens/ConnectionsScreen/hooks/useConnectionsScreen.ts");
  const src = fs.readFileSync(file, "utf8");

  it("uses a busy guard helper for save/test actions", () => {
    expect(src).toContain("const withBusyGuard = useCallback");
    expect(src).toContain("BusyGuardActiveError");
    expect(src).toContain("isBusyGuardActiveError");
  });

  it("routes testEas through busy guard semantics with explicit busy feedback", () => {
    const start = src.indexOf("const testEas = useCallback(async () => {");
    const end = src.indexOf("// Expo connection light is persisted");
    const block = src.slice(start, end);
    expect(block).toContain("await withBusyGuard(async () => {");
    expect(block).toContain("if (isBusyGuardActiveError(e))");
    expect(block).toContain('Alert.alert("Bitte warten", e.message)');
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

  it("routes EAS link/create flows through one shared start helper", () => {
    expect(src).toContain("const startEasWorkflow = useCallback");
    expect(src).toContain("await startEasWorkflow({");
  });

  it("reuses one shared selection resolver for both EAS launch paths", () => {
    expect(src).toContain("const resolveCurrentEasLaunchSelection = useCallback");
    expect(src).toContain("const launchSelection = resolveCurrentEasLaunchSelection();");
  });
});
