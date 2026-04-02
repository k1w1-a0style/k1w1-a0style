import fs from "fs";
import path from "path";

describe("Preview fullscreen guard invariants", () => {
  const hookFile = path.join(process.cwd(), "screens/PreviewScreen/hooks/usePreviewScreen.ts");
  const toolbarFile = path.join(process.cwd(), "screens/PreviewScreen/components/PreviewToolbar.tsx");
  const hookSource = fs.readFileSync(hookFile, "utf8");
  const toolbarSource = fs.readFileSync(toolbarFile, "utf8");

  it("derives fullscreen availability from the active previewSource", () => {
    expect(hookSource).toContain("const canOpenFullscreen = Boolean(previewSource);");
    expect(hookSource).toContain("if (!previewSource) return;");
    expect(hookSource).toContain("previewSource.type === 'url' ? previewSource.uri : undefined");
  });

  it("disables the fullscreen button when no valid preview is available", () => {
    expect(toolbarSource).toContain("canFullscreen: boolean;");
    expect(toolbarSource).toContain("disabled={!canFullscreen}");
    expect(toolbarSource).toContain("accessibilityState={{ disabled: !canFullscreen }}");
  });
});
