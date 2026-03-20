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

import { getEdgeAdminKey, saveEdgeAdminKey } from "../infra/github/tokenStore";

describe("edge admin key token store contract", () => {
  beforeEach(() => {
    mockSecureStore.getItemAsync.mockReset();
    mockSecureStore.setItemAsync.mockReset();
    mockSecureStore.deleteItemAsync.mockReset();
  });

  it("trims the key on save and re-reads the same persisted value", async () => {
    const persisted = new Map<string, string>();
    mockSecureStore.setItemAsync.mockImplementation(async (key: string, value: string) => {
      persisted.set(key, value);
    });
    mockSecureStore.getItemAsync.mockImplementation(async (key: string) => persisted.get(key) ?? null);

    await saveEdgeAdminKey("  edge-admin-key-12345678901234567890  ");

    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      "edge_admin_key_v1",
      "edge-admin-key-12345678901234567890",
    );
    await expect(getEdgeAdminKey()).resolves.toBe("edge-admin-key-12345678901234567890");
  });
});
