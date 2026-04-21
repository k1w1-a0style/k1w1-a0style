jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: { UTF8: "utf8" },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../lib/appInfoScopedBackup", () => ({
  validateEncryptedScopedBackupJson: jest.fn(),
  decryptScopedBackup: jest.fn(),
  secureBackupNeedsCryptoUpgrade: jest.fn(),
  encryptScopedBackup: jest.fn(),
}));

import { importEncryptedScopedBackup } from "../screens/AppInfoScreen/hooks/importExportHelpers";

describe("importEncryptedScopedBackup upgrade contract", () => {
  test("legacy-compatible imports return honest upgrade hint without fabricated normalized artifact", async () => {
    const DocumentPicker = require("expo-document-picker");
    const FileSystem = require("expo-file-system/legacy");
    const backupCrypto = require("../lib/appInfoScopedBackup");

    const encrypted = {
      type: "k1w1-secure-backup",
      version: 1,
      scope: "secrets",
      exportDate: "2026-04-20T10:00:00.000Z",
      appVersion: "1.0.0",
      encryption: {
        algorithm: "AES-GCM",
        kdf: "PBKDF2-SHA-256",
        iterations: 150000,
        saltBase64: "c2FsdA==",
        ivBase64: "aXY=",
      },
      ciphertextBase64: "Y2lwaGVy",
    };
    const decryptedPayload = {
      kind: "secret-snapshot",
      version: 1,
      exportDate: "2026-04-20T10:00:00.000Z",
      connections: { supabaseRaw: "", supabaseUrl: "", supabaseAnonKey: "", easProjectId: "" },
      tokens: {
        githubToken: null,
        expoToken: null,
        workflowAdminKey: null,
        androidKeystoreExportAdminKey: null,
        legacyEdgeAdminKey: null,
        signingAdminKey: null,
        signingMasterKey: null,
      },
      ciSecrets: {},
      github: { linkedRepo: null, linkedBranch: null, recentRepos: [] },
    };

    DocumentPicker.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///cache/import.json" }],
    });
    FileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(encrypted));
    backupCrypto.validateEncryptedScopedBackupJson.mockReturnValue(encrypted);
    backupCrypto.decryptScopedBackup.mockResolvedValue(decryptedPayload);
    backupCrypto.secureBackupNeedsCryptoUpgrade.mockReturnValue(true);

    const result = await importEncryptedScopedBackup("correct-passphrase");

    expect(result.success).toBe(true);
    expect(result.data).toEqual(decryptedPayload);
    expect(result.needsCryptoUpgrade).toBe(true);
    expect(result).not.toHaveProperty("normalizedBackup");
    expect(backupCrypto.decryptScopedBackup).toHaveBeenCalledTimes(1);
    expect(backupCrypto.encryptScopedBackup).not.toHaveBeenCalled();
  });
});
