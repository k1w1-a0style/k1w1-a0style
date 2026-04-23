import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const MAIN_MANIFEST_PATH = path.join(ROOT, "android/app/src/main/AndroidManifest.xml");

describe("android main manifest permissions invariants", () => {
  it("does not include legacy unnecessary permissions in production manifest", () => {
    const manifest = fs.readFileSync(MAIN_MANIFEST_PATH, "utf8");

    expect(manifest).not.toContain("android.permission.READ_EXTERNAL_STORAGE");
    expect(manifest).not.toContain("android.permission.WRITE_EXTERNAL_STORAGE");
    expect(manifest).not.toContain("android.permission.RECORD_AUDIO");
    expect(manifest).not.toContain("android.permission.SYSTEM_ALERT_WINDOW");
  });

  it("keeps expo update URL build-resolvable without committing project-bound URLs", () => {
    const manifest = fs.readFileSync(MAIN_MANIFEST_PATH, "utf8");
    const strings = fs.readFileSync(
      path.join(ROOT, "android/app/src/main/res/values/strings.xml"),
      "utf8"
    );

    expect(manifest).toContain('expo.modules.updates.EXPO_UPDATE_URL" android:value="${expoUpdateUrl}"');
    expect(manifest).not.toMatch(/https:\/\/u\.expo\.dev\/[0-9a-f-]{36}/i);
    expect(strings).not.toContain("expo_update_url");
    expect(strings).not.toMatch(/https:\/\/u\.expo\.dev\/[0-9a-f-]{36}/i);
  });
});
