import AsyncStorage from "@react-native-async-storage/async-storage";

import { readGuardAuditSnapshot, recordGuardAuditEvent } from "../guardAuditTelemetry";
import { STORAGE_KEYS } from "../storageKeys";

describe("guardAuditTelemetry", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("records guard events and marker buckets", async () => {
    await recordGuardAuditEvent([
      "kritisch/manual-only path",
      "baseline file read-only",
      "ownership block detected",
    ]);

    const snapshot = await readGuardAuditSnapshot();
    expect(snapshot.totalGuardEvents).toBe(1);
    expect(snapshot.totalGuardEntries).toBe(3);
    expect(snapshot.markerCounts["manual-only"]).toBe(1);
    expect(snapshot.markerCounts["read-only"]).toBe(1);
    expect(snapshot.markerCounts["ownership block"]).toBe(1);
    expect(snapshot.lastSeenAt).toBeTruthy();
  });

  it("is resilient against malformed stored payloads", async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.CHAT_GUARD_AUDIT, "{bad-json");
    const snapshot = await readGuardAuditSnapshot();

    expect(snapshot.totalGuardEvents).toBe(0);
    expect(snapshot.totalGuardEntries).toBe(0);
    expect(snapshot.markerCounts).toEqual({});
  });
});
