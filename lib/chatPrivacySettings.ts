import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "./storageKeys";

const DEFAULT_PERSIST = true;
const DEFAULT_RETENTION = 200;

function parseBool(value: string | null): boolean | null {
  if (value == null) return null;
  const v = value.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return null;
}

export async function getChatHistoryPersistence(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_PERSIST_HISTORY);
    const parsed = parseBool(raw);
    return parsed ?? DEFAULT_PERSIST;
  } catch (error) {
    console.warn("[chatPrivacySettings] failed to read persistence flag; using default", error);
    return DEFAULT_PERSIST;
  }
}

export async function setChatHistoryPersistence(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.CHAT_PERSIST_HISTORY, enabled ? "1" : "0");
  } catch (error) {
    console.warn("[chatPrivacySettings] failed to persist persistence flag", error);
  }
}

export async function getChatHistoryRetentionLimit(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_RETENTION_LIMIT);
    // IMPORTANT: missing key => null. Number(null) === 0 would wipe history.
    if (raw == null) return DEFAULT_RETENTION;
    const trimmed = raw.trim();
    if (trimmed.length === 0) return DEFAULT_RETENTION;

    const n = Number(trimmed);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
    return DEFAULT_RETENTION;
  } catch (error) {
    console.warn("[chatPrivacySettings] failed to read retention limit; using default", error);
    return DEFAULT_RETENTION;
  }
}

export async function setChatHistoryRetentionLimit(limit: number): Promise<void> {
  const safeLimit =
    Number.isFinite(limit) && limit >= 0 ? Math.floor(limit) : DEFAULT_RETENTION;
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.CHAT_RETENTION_LIMIT, String(safeLimit));
  } catch (error) {
    console.warn("[chatPrivacySettings] failed to persist retention limit", error);
  }
}

export async function loadChatHistorySettings(): Promise<{
  persist: boolean;
  retention: number;
}> {
  const [persist, retention] = await Promise.all([
    getChatHistoryPersistence(),
    getChatHistoryRetentionLimit(),
  ]);
  return { persist, retention };
}
