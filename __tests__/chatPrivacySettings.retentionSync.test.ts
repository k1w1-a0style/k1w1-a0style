import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "../lib/storageKeys";
import {
  onChatHistoryRetentionLimitChange,
  setChatHistoryRetentionLimit,
} from "../lib/chatPrivacySettings";

describe("chatPrivacySettings retention sync", () => {
  beforeEach(() => {
    (AsyncStorage as any).__resetMockStorage?.();
  });

  it("notifies active listeners after retention limit was persisted", async () => {
    const listener = jest.fn<void, [number]>();
    const unsubscribe = onChatHistoryRetentionLimitChange(listener);

    await setChatHistoryRetentionLimit(123);

    expect(listener).toHaveBeenCalledWith(123);
    expect(await AsyncStorage.getItem(STORAGE_KEYS.CHAT_RETENTION_LIMIT)).toBe(
      "123",
    );

    unsubscribe();
  });

  it("stops notifying listeners after unsubscribe", async () => {
    const listener = jest.fn<void, [number]>();
    const unsubscribe = onChatHistoryRetentionLimitChange(listener);
    unsubscribe();

    await setChatHistoryRetentionLimit(77);

    expect(listener).not.toHaveBeenCalled();
  });
});
