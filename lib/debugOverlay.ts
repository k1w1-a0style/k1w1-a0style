export type DebugEntry = {
  ts: number;
  scope: string;
  message: string;
  data?: unknown;
};

const MAX_ENTRIES = 250;

const entries: DebugEntry[] = [];
const listeners = new Set<(items: DebugEntry[]) => void>();

function snapshot(): DebugEntry[] {
  // newest first
  return [...entries].reverse();
}

function notify(): void {
  const snap = snapshot();
  for (const cb of listeners) {
    try {
      cb(snap);
    } catch {
      // ignore bad listeners
    }
  }
}

export function debugLog(scope: string, message: string, data?: unknown): void {
  entries.push({ ts: Date.now(), scope, message, data });
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
  notify();
}

export function getDebugEntries(): DebugEntry[] {
  return snapshot();
}

export function clearDebugEntries(): void {
  entries.length = 0;
  notify();
}

export function subscribeDebugEntries(cb: (items: DebugEntry[]) => void): () => void {
  listeners.add(cb);
  try {
    cb(snapshot());
  } catch {
    // ignore
  }
  return () => listeners.delete(cb);
}
