import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "./storageKeys";

export type ChatQualityMetricKind =
  | "intent_confirmation_prompt"
  | "intent_confirmation_planen"
  | "intent_confirmation_build";

type ChatQualityMetricsSnapshot = {
  totalEvents: number;
  lastSeenAt: string | null;
  counters: Record<ChatQualityMetricKind, number>;
};

const EMPTY_SNAPSHOT: ChatQualityMetricsSnapshot = {
  totalEvents: 0,
  lastSeenAt: null,
  counters: {
    intent_confirmation_prompt: 0,
    intent_confirmation_planen: 0,
    intent_confirmation_build: 0,
  },
};

function parseSnapshot(raw: string | null): ChatQualityMetricsSnapshot {
  if (!raw) return { ...EMPTY_SNAPSHOT, counters: { ...EMPTY_SNAPSHOT.counters } };
  try {
    const parsed = JSON.parse(raw) as Partial<ChatQualityMetricsSnapshot>;
    const counters = parsed.counters && typeof parsed.counters === "object" ? parsed.counters : {};
    return {
      totalEvents: Math.max(0, Number(parsed.totalEvents ?? 0) || 0),
      lastSeenAt: typeof parsed.lastSeenAt === "string" ? parsed.lastSeenAt : null,
      counters: {
        intent_confirmation_prompt: Math.max(
          0,
          Number((counters as Record<string, unknown>).intent_confirmation_prompt ?? 0) || 0,
        ),
        intent_confirmation_planen: Math.max(
          0,
          Number((counters as Record<string, unknown>).intent_confirmation_planen ?? 0) || 0,
        ),
        intent_confirmation_build: Math.max(
          0,
          Number((counters as Record<string, unknown>).intent_confirmation_build ?? 0) || 0,
        ),
      },
    };
  } catch {
    return { ...EMPTY_SNAPSHOT, counters: { ...EMPTY_SNAPSHOT.counters } };
  }
}

export async function recordChatQualityMetric(kind: ChatQualityMetricKind): Promise<void> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_QUALITY_METRICS);
  const snapshot = parseSnapshot(raw);
  const next: ChatQualityMetricsSnapshot = {
    totalEvents: snapshot.totalEvents + 1,
    lastSeenAt: new Date().toISOString(),
    counters: {
      ...snapshot.counters,
      [kind]: (snapshot.counters[kind] ?? 0) + 1,
    },
  };
  await AsyncStorage.setItem(STORAGE_KEYS.CHAT_QUALITY_METRICS, JSON.stringify(next));
}

export async function readChatQualityMetricsSnapshot(): Promise<ChatQualityMetricsSnapshot> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_QUALITY_METRICS);
  return parseSnapshot(raw);
}
