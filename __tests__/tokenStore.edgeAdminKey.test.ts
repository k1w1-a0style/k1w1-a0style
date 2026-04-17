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
  getGitHubToken,
  getExpoToken,
  getWorkflowAdminKey,
  saveWorkflowAdminKey,
  getAndroidKeystoreExportAdminKey,
  saveAndroidKeystoreExportAdminKey,
  getLegacyEdgeAdminKey,
  saveLegacyEdgeAdminKey,
  getSigningAdminKey,
  saveSigningAdminKey,
  SecureTokenReadError,
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
    await saveLegacyEdgeAdminKey("  legacy-edge-key-12345678901234567890  ");
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
    await expect(getLegacyEdgeAdminKey()).resolves.toBe("legacy-edge-key-12345678901234567890");
    await expect(getSigningAdminKey()).resolves.toBe("signing-admin-key-12345678901234567890");
  });

  it("migrates legacy edge_admin_key_v1 to workflow_admin_key_v1 once when workflow key is missing", async () => {
    const persisted = new Map<string, string>([
      ["edge_admin_key_v1", "legacy-edge-key-12345678901234567890"],
    ]);
    mockSecureStore.setItemAsync.mockImplementation(async (key: string, value: string) => {
      persisted.set(key, value);
    });
    mockSecureStore.getItemAsync.mockImplementation(async (key: string) => persisted.get(key) ?? null);

    await expect(getWorkflowAdminKey()).resolves.toBe("legacy-edge-key-12345678901234567890");
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      "workflow_admin_key_v1",
      "legacy-edge-key-12345678901234567890",
    );
    expect(persisted.get("workflow_admin_key_v1")).toBe("legacy-edge-key-12345678901234567890");
    expect(persisted.get("edge_admin_key_v1")).toBe("legacy-edge-key-12345678901234567890");
  });

  it("does not silently mirror scoped workflow updates back into legacy slot", async () => {
    const persisted = new Map<string, string>([
      ["edge_admin_key_v1", "legacy-edge-key-12345678901234567890"],
    ]);
    mockSecureStore.setItemAsync.mockImplementation(async (key: string, value: string) => {
      persisted.set(key, value);
    });
    mockSecureStore.getItemAsync.mockImplementation(async (key: string) => persisted.get(key) ?? null);

    await saveWorkflowAdminKey("workflow-only-key-12345678901234567890");
    expect(persisted.get("workflow_admin_key_v1")).toBe("workflow-only-key-12345678901234567890");
    expect(persisted.get("edge_admin_key_v1")).toBe("legacy-edge-key-12345678901234567890");

    await saveLegacyEdgeAdminKey("legacy-only-key-12345678901234567890");
    expect(persisted.get("edge_admin_key_v1")).toBe("legacy-only-key-12345678901234567890");
    expect(persisted.get("workflow_admin_key_v1")).toBe("workflow-only-key-12345678901234567890");
  });

  it("does not degrade secure-store read failures to missing admin keys", async () => {
    mockSecureStore.getItemAsync.mockRejectedValue(new Error("secure read blocked"));

    await expect(getWorkflowAdminKey()).rejects.toBeInstanceOf(SecureTokenReadError);
  });

  it("does not let unreadable legacy github slot block readable modern token", async () => {
    mockSecureStore.getItemAsync.mockImplementation(async (key: string) => {
      if (key === "github_pat_v1") throw new Error("legacy unreadable");
      if (key === "github_token") return "modern-gh-token";
      return null;
    });

    await expect(getGitHubToken()).resolves.toBe("modern-gh-token");
  });

  it("does not let unreadable legacy expo slot block readable modern token", async () => {
    mockSecureStore.getItemAsync.mockImplementation(async (key: string) => {
      if (key === "expo_token_v1") throw new Error("legacy unreadable");
      if (key === "expo_token") return "modern-expo-token";
      return null;
    });

    await expect(getExpoToken()).resolves.toBe("modern-expo-token");
  });

  it("keeps migration fail-closed neutral when legacy slot is unreadable and no modern token exists", async () => {
    mockSecureStore.getItemAsync.mockImplementation(async (key: string) => {
      if (key === "github_pat_v1") throw new Error("legacy unreadable");
      if (key === "github_token") return null;
      return null;
    });

    await expect(getGitHubToken()).resolves.toBeNull();
  });
});
