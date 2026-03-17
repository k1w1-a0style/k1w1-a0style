import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  assertProjectStoragePayloadSafe,
  PROJECT_STORAGE_HARD_LIMIT_BYTES,
  PROJECT_STORAGE_SOFT_LIMIT_BYTES,
} from "../infra/storage/persistenceHelpers";
import { saveProjectToStorage } from "../infra/storage/projectPersistence";

jest.mock("../lib/chatPrivacySettings", () => ({
  loadChatHistorySettings: jest.fn(async () => ({ persist: true, retention: 10_000 })),
}));

describe("project persistence size guard", () => {
  beforeEach(() => {
    (AsyncStorage as any).__resetMockStorage?.();
    jest.clearAllMocks();
  });

  it("marks payloads above soft limit as near-limit", () => {
    const payload = "x".repeat(PROJECT_STORAGE_SOFT_LIMIT_BYTES + 10);
    const result = assertProjectStoragePayloadSafe(payload);
    expect(result.nearLimit).toBe(true);
    expect(result.bytes).toBeGreaterThan(PROJECT_STORAGE_SOFT_LIMIT_BYTES);
  });

  it("throws for payloads above hard limit", () => {
    const payload = "x".repeat(PROJECT_STORAGE_HARD_LIMIT_BYTES + 1);
    expect(() => assertProjectStoragePayloadSafe(payload)).toThrow(
      /exceeds storage hard limit/i,
    );
  });

  it("fails loudly and avoids AsyncStorage write when project payload is oversized", async () => {
    const oversizedContent = "x".repeat(PROJECT_STORAGE_HARD_LIMIT_BYTES + 3_000);
    const oversizedProject: any = {
      name: "oversized",
      files: [{ path: "big.txt", content: oversizedContent }],
      chatHistory: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      lastModified: "2026-01-01T00:00:00.000Z",
    };

    await expect(saveProjectToStorage(oversizedProject)).rejects.toThrow(
      "Projekt konnte nicht gespeichert werden",
    );
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});
