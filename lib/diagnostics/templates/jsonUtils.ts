// Shared JSON helpers for template patchers.

export type JsonRecord = Record<string, unknown>;

export function isJsonRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function ensureObj(value: unknown): JsonRecord {
  return isJsonRecord(value) ? value : {};
}

export function getErrorMessage(error: unknown, fallback = "parse failed"): string {
  if (error instanceof Error && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

export function upsertDep(obj: JsonRecord, name: string, version: string): boolean {
  if (obj[name] !== version) {
    obj[name] = version;
    return true;
  }
  return false;
}

export function majorOf(v: unknown): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const m = s.match(/(\d+)\./);
  if (!m) return null;
  return Number(m[1]);
}
