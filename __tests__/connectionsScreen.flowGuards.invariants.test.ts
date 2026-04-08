import fs from "node:fs";
import path from "node:path";

describe("connectionsScreen flow guards invariants", () => {
  const orchestratorFile = path.join(process.cwd(), "screens/ConnectionsScreen/hooks/useConnectionsScreen.ts");
  const busyFile = path.join(process.cwd(), "screens/ConnectionsScreen/hooks/useConnectionsBusyAction.ts");
  const providerFile = path.join(process.cwd(), "screens/ConnectionsScreen/hooks/useConnectionsProviderTests.ts");
  const easLinkFile = path.join(process.cwd(), "screens/ConnectionsScreen/hooks/useConnectionsEasLink.ts");
  const src = fs.readFileSync(orchestratorFile, "utf8");
  const busySrc = fs.readFileSync(busyFile, "utf8");
  const providerSrc = fs.readFileSync(providerFile, "utf8");
  const easLinkSrc = fs.readFileSync(easLinkFile, "utf8");

  it("uses a busy guard helper for save/test actions", () => {
    expect(busySrc).toContain("const withBusyGuard = useCallback");
    expect(busySrc).toContain("BusyGuardActiveError");
    expect(busySrc).toContain("isBusyGuardActiveError");
    expect(src).toContain("useConnectionsBusyAction");
  });

  it("routes testEas through shared guarded action handling", () => {
    const start = providerSrc.indexOf("const testEas = useCallback(async () => {");
    const end = providerSrc.indexOf("return {");
    const block = providerSrc.slice(start, end);
    expect(block).toContain("await runGuardedAction({");
    expect(block).toContain('defaultTitle: "EAS Test"');
    expect(block).not.toContain('Alert.alert("Bitte warten", e.message)');
  });

  it("does not persist Expo token as side effect in testExpo", () => {
    const start = providerSrc.indexOf("const testExpo = useCallback(async () => {");
    const end = providerSrc.indexOf("const testSupabase = useCallback(async () => {");
    const block = providerSrc.slice(start, end);
    expect(block).not.toContain("saveExpoToken(");
  });

  it("does not set optimistic eas ok true right after workflow trigger", () => {
    const start = easLinkSrc.indexOf("const onLinkExisting = useCallback(async () => {");
    const end = easLinkSrc.indexOf("const onCreateAndLink = useCallback(async () => {");
    const block = easLinkSrc.slice(start, end);
    expect(block).toContain("setEasOk(false)");
    expect(block).not.toContain("setEasOk(true)");
  });

  it("routes EAS link/create flows through one shared start helper", () => {
    expect(easLinkSrc).toContain("const startEasWorkflow = useCallback");
    expect(easLinkSrc).toContain("await startEasWorkflow({");
  });

  it("reuses one shared selection resolver for both EAS launch paths", () => {
    expect(easLinkSrc).toContain("const resolveCurrentEasLaunchSelection = useCallback");
    expect(easLinkSrc).toContain("const launchSelection = resolveCurrentEasLaunchSelection();");
  });

  it("keeps save and status derivation out of the thin orchestrator", () => {
    expect(src).toContain("useConnectionsSaveActions");
    expect(src).toContain("useConnectionsStatusModel");
    expect(src).not.toContain("resolveConnectionsSavePlan");
    expect(src).not.toContain("resolveConnectionsStatusFlags({");
  });
});
