import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PERSIST_CHAT = "k1w1_chat_persist_history";
const KEY_CHAT_RETENTION = "k1w1_chat_retention_limit";

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
    const raw = await AsyncStorage.getItem(KEY_PERSIST_CHAT);
    const parsed = parseBool(raw);
    return parsed ?? DEFAULT_PERSIST;
  } catch {
    return DEFAULT_PERSIST;
  }
}

export async function setChatHistoryPersistence(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_PERSIST_CHAT, enabled ? "1" : "0");
  } catch {
    // best-effort (privacy toggle should never crash)
  }
}

export async function getChatHistoryRetentionLimit(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY_CHAT_RETENTION);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
    return DEFAULT_RETENTION;
  } catch {
    return DEFAULT_RETENTION;
  }
}

export async function setChatHistoryRetentionLimit(limit: number): Promise<void> {
  const safeLimit =
    Number.isFinite(limit) && limit >= 0 ? Math.floor(limit) : DEFAULT_RETENTION;
  try {
    await AsyncStorage.setItem(KEY_CHAT_RETENTION, String(safeLimit));
  } catch {}
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
