import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "./storageKeys";

type GuardAuditSnapshot = {
  totalGuardEvents: number;
  totalGuardEntries: number;
  lastSeenAt: string | null;
  markerCounts: Record<string, number>;
};

const EMPTY_SNAPSHOT: GuardAuditSnapshot = {
  totalGuardEvents: 0,
  totalGuardEntries: 0,
  lastSeenAt: null,
  markerCounts: {},
};

const MARKER_BUCKETS = [
  "manual-only",
  "kritisch",
  "read-only",
  "baseline",
  "ownership block",
  "guarded",
] as const;

function toMarkerBucket(entry: string): string {
  const lower = entry.toLowerCase();
  return MARKER_BUCKETS.find((marker) => lower.includes(marker)) ?? "other";
}

function parseSnapshot(raw: string | null): GuardAuditSnapshot {
  if (!raw) return { ...EMPTY_SNAPSHOT };
  try {
    const parsed = JSON.parse(raw) as Partial<GuardAuditSnapshot>;
    return {
      totalGuardEvents: Math.max(0, Number(parsed.totalGuardEvents ?? 0) || 0),
      totalGuardEntries: Math.max(0, Number(parsed.totalGuardEntries ?? 0) || 0),
      lastSeenAt: typeof parsed.lastSeenAt === "string" ? parsed.lastSeenAt : null,
      markerCounts:
        parsed.markerCounts && typeof parsed.markerCounts === "object"
          ? Object.fromEntries(
              Object.entries(parsed.markerCounts)
                .map(([k, v]) => [k, Math.max(0, Number(v) || 0)])
                .slice(0, 20),
            )
          : {},
    };
  } catch {
    return { ...EMPTY_SNAPSHOT };
  }
}

export async function recordGuardAuditEvent(entries: string[]): Promise<void> {
  if (!entries.length) return;

  const raw = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_GUARD_AUDIT);
  const snapshot = parseSnapshot(raw);

  const markerCounts = { ...snapshot.markerCounts };
  for (const entry of entries) {
    const bucket = toMarkerBucket(String(entry));
    markerCounts[bucket] = (markerCounts[bucket] ?? 0) + 1;
  }

  const next: GuardAuditSnapshot = {
    totalGuardEvents: snapshot.totalGuardEvents + 1,
    totalGuardEntries: snapshot.totalGuardEntries + entries.length,
    lastSeenAt: new Date().toISOString(),
    markerCounts,
  };

  await AsyncStorage.setItem(STORAGE_KEYS.CHAT_GUARD_AUDIT, JSON.stringify(next));
}

export async function readGuardAuditSnapshot(): Promise<GuardAuditSnapshot> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_GUARD_AUDIT);
  return parseSnapshot(raw);
}
