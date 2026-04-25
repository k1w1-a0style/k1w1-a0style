import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const MAIN_MANIFEST_PATH = path.join(ROOT, "android/app/src/main/AndroidManifest.xml");
const BACKUP_RULES_PATH = path.join(
  ROOT,
  "android/app/src/main/res/xml/secure_store_backup_rules.xml"
);
const DATA_EXTRACTION_RULES_PATH = path.join(
  ROOT,
  "android/app/src/main/res/xml/secure_store_data_extraction_rules.xml"
);

describe("android backup/data extraction contract invariants", () => {
  it("disables Android Auto Backup at application level", () => {
    const manifest = fs.readFileSync(MAIN_MANIFEST_PATH, "utf8");

    expect(manifest).toContain('android:allowBackup="false"');
  });

  it("references existing backup XML resources from main manifest", () => {
    const manifest = fs.readFileSync(MAIN_MANIFEST_PATH, "utf8");

    expect(manifest).toContain('android:fullBackupContent="@xml/secure_store_backup_rules"');
    expect(manifest).toContain('android:dataExtractionRules="@xml/secure_store_data_extraction_rules"');
    expect(fs.existsSync(BACKUP_RULES_PATH)).toBe(true);
    expect(fs.existsSync(DATA_EXTRACTION_RULES_PATH)).toBe(true);
  });

  it("keeps secure backup/data extraction fail-closed for sensitive app data", () => {
    const backupRules = fs.readFileSync(BACKUP_RULES_PATH, "utf8");
    const dataExtractionRules = fs.readFileSync(DATA_EXTRACTION_RULES_PATH, "utf8");

    expect(backupRules).toContain('<exclude domain="root" path="." />');
    expect(backupRules).toContain('<exclude domain="sharedpref" path="SecureStore" />');

    expect(dataExtractionRules).toContain("<cloud-backup>");
    expect(dataExtractionRules).toContain("<device-transfer>");
    expect(dataExtractionRules).toContain('<exclude domain="root" path="." />');
    expect(dataExtractionRules).toContain('<exclude domain="sharedpref" path="SecureStore" />');
  });
});
