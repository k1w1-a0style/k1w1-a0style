const mockSecureStore = {
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
};

jest.mock("expo-secure-store", () => ({
  getItemAsync: (...args: unknown[]) => mockSecureStore.getItemAsync(...args),
  setItemAsync: (...args: unknown[]) => mockSecureStore.setItemAsync(...args),
  deleteItemAsync: (...args: unknown[]) => mockSecureStore.deleteItemAsync(...args),
}));
jest.mock("../lib/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import {
  getWorkflowAdminKey,
  saveWorkflowAdminKey,
  getAndroidKeystoreExportAdminKey,
  saveAndroidKeystoreExportAdminKey,
  getEdgeAdminKey,
  saveEdgeAdminKey,
  getSigningAdminKey,
  saveSigningAdminKey,
} from "../infra/github/tokenStore";

describe("admin key token store split contract", () => {
  beforeEach(() => {
    mockSecureStore.getItemAsync.mockReset();
    mockSecureStore.setItemAsync.mockReset();
    mockSecureStore.deleteItemAsync.mockReset();
  });

  it("stores workflow, keystore-export, legacy and signing admin keys in separate secure-store slots", async () => {
    const persisted = new Map<string, string>();
    mockSecureStore.setItemAsync.mockImplementation(async (key: string, value: string) => {
      persisted.set(key, value);
    });
    mockSecureStore.getItemAsync.mockImplementation(async (key: string) => persisted.get(key) ?? null);

    await saveWorkflowAdminKey("  workflow-admin-key-12345678901234567890  ");
    await saveAndroidKeystoreExportAdminKey("  android-export-key-12345678901234567890  ");
    await saveEdgeAdminKey("  legacy-edge-key-12345678901234567890  ");
    await saveSigningAdminKey("  signing-admin-key-12345678901234567890  ");

    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      "workflow_admin_key_v1",
      "workflow-admin-key-12345678901234567890",
    );
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      "android_keystore_export_admin_key_v1",
      "android-export-key-12345678901234567890",
    );
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      "edge_admin_key_v1",
      "legacy-edge-key-12345678901234567890",
    );
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      "signing_admin_key_v1",
      "signing-admin-key-12345678901234567890",
    );

    await expect(getWorkflowAdminKey()).resolves.toBe("workflow-admin-key-12345678901234567890");
    await expect(getAndroidKeystoreExportAdminKey()).resolves.toBe("android-export-key-12345678901234567890");
    await expect(getEdgeAdminKey()).resolves.toBe("legacy-edge-key-12345678901234567890");
    await expect(getSigningAdminKey()).resolves.toBe("signing-admin-key-12345678901234567890");
  });
});
