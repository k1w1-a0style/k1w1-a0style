export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function asRecord(value: unknown): UnknownRecord | null {
  return isRecord(value) ? value : null;
}

export function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function readTrimmedString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

export function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function readStringArray(value: unknown, maxItems = 100): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const normalized = entry.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (out.length >= maxItems) break;
  }

  return out;
}

export function readStringRecord(
  value: unknown,
  maxKeyLength = 100,
  maxValueLength = 2000,
): Record<string, string> | null {
  const record = asRecord(value);
  if (!record) return null;

  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (typeof key !== "string" || key.length > maxKeyLength) return null;
    if (typeof entry !== "string" || entry.length > maxValueLength) return null;
    out[key] = entry;
  }
  return out;
}
