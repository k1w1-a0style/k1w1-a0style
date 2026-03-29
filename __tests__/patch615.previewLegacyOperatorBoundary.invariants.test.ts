import fs from "fs";
import path from "path";

const ROOT = process.cwd();

describe("patch615 preview legacy operator boundary", () => {
  it("keeps legacy save_preview usage behind an explicit operator-mode guard", () => {
    const previewHook = fs.readFileSync(path.join(ROOT, "hooks/usePreview.ts"), "utf8");

    expect(previewHook).toContain("isLegacyPreviewOperatorModeEnabled");
    expect(previewHook).toContain("LEGACY_PREVIEW_OPERATOR_MODE_REQUIRED");
    expect(previewHook).toContain(
      "Legacy save_preview ist jetzt ein expliziter Operator-/Maintenance-Vertrag",
    );

    const gateIndex = previewHook.indexOf("LEGACY_PREVIEW_OPERATOR_MODE_REQUIRED");
    const legacyReadIndex = previewHook.indexOf("getLegacyEdgeAdminKey(");
    expect(gateIndex).toBeGreaterThan(-1);
    expect(legacyReadIndex).toBeGreaterThan(-1);
    expect(gateIndex).toBeLessThan(legacyReadIndex);
  });
});
