import { getSecureBackupImportSuccessMessage } from "../screens/AppInfoScreen/hooks/useAppInfoSecureBackupFlow";

describe("secure backup import success message contract", () => {
  test("legacy import message stays honest and asks for explicit re-export", () => {
    const message = getSecureBackupImportSuccessMessage({
      scopeText: "Secrets",
      exportDate: "20.04.2026, 10:00:00",
      needsCryptoUpgrade: true,
    });

    expect(message).toContain("neuer Export erforderlich");
    expect(message).not.toContain("automatisch auf den aktuellen Crypto-/KDF-Standard normalisiert");
  });

  test("current-format import does not include legacy re-export note", () => {
    const message = getSecureBackupImportSuccessMessage({
      scopeText: "Secrets + KI-Konfiguration",
      exportDate: "20.04.2026, 10:00:00",
      needsCryptoUpgrade: false,
    });

    expect(message).not.toContain("neuer Export erforderlich");
  });
});
