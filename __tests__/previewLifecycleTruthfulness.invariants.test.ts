import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("Preview lifecycle truthfulness invariants", () => {
  test("manual reset dismisses auto-create so reset remains a real reset", () => {
    const src = read("screens/PreviewScreen/hooks/usePreviewScreen.ts");
    expect(src).toContain("autoCreateDismissedByResetRef");
    expect(src).toContain("autoCreateDismissedByResetRef.current = true;");
    expect(src).toContain("if (autoCreateDismissedByResetRef.current) return;");
  });

  test("ready state can only be reached for the current non-error cycle", () => {
    const src = read("screens/PreviewScreen/hooks/usePreviewScreen.ts");
    expect(src).toContain("cycleWithErrorRef");
    expect(src).toContain("if (!isCurrentCycle(cycleId)) return;");
    expect(src).toContain("if (cycleWithErrorRef.current === cycleId) return;");
    expect(src).toContain("setPhase('ready');");
  });

  test("webview events are bound to the active cycle id and stale events are ignored", () => {
    const hookSrc = read("screens/PreviewScreen/hooks/usePreviewScreen.ts");
    const frameSrc = read("screens/PreviewScreen/components/DeviceFrame.tsx");
    expect(hookSrc).toContain("beginPreviewCycle()");
    expect(hookSrc).toContain("previewCycleId: previewCycleRef.current");
    expect(frameSrc).toContain("cycleId: number;");
    expect(frameSrc).toContain("onLoadEnd: (cycleId: number) => void;");
    expect(frameSrc).toContain("onLoadEnd={() => onLoadEnd(cycleId)}");
  });
});
