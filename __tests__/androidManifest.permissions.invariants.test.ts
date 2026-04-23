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
});
