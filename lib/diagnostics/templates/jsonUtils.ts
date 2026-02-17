// Shared JSON helpers for template patchers.

export function ensureObj(value: any): any {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function upsertDep(obj: any, name: string, version: string): boolean {
  if (!obj || typeof obj !== "object") return false;
  if (obj[name] !== version) {
    obj[name] = version;
    return true;
  }
  return false;
}

export function majorOf(v: any): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const m = s.match(/(\d+)\./);
  if (!m) return null;
  return Number(m[1]);
}
