import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  readChatQualityMetricsSnapshot,
  recordChatQualityMetric,
} from "../chatQualityMetrics";
import { STORAGE_KEYS } from "../storageKeys";

describe("chatQualityMetrics", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("records local intent confirmation counters", async () => {
    await recordChatQualityMetric("intent_confirmation_prompt");
    await recordChatQualityMetric("intent_confirmation_planen");
    await recordChatQualityMetric("intent_confirmation_build");

    const snapshot = await readChatQualityMetricsSnapshot();
    expect(snapshot.totalEvents).toBe(3);
    expect(snapshot.counters.intent_confirmation_prompt).toBe(1);
    expect(snapshot.counters.intent_confirmation_planen).toBe(1);
    expect(snapshot.counters.intent_confirmation_build).toBe(1);
    expect(snapshot.lastSeenAt).toBeTruthy();
  });

  it("is resilient against malformed storage payloads", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.CHAT_QUALITY_METRICS, "{bad-json");
    const snapshot = await readChatQualityMetricsSnapshot();

    expect(snapshot.totalEvents).toBe(0);
    expect(snapshot.counters.intent_confirmation_prompt).toBe(0);
    expect(snapshot.counters.intent_confirmation_planen).toBe(0);
    expect(snapshot.counters.intent_confirmation_build).toBe(0);
  });
});
