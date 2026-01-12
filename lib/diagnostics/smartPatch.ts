// lib/diagnostics/smartPatch.ts

/**
 * Apply a "smart" JSON merge patch.
 * - Merges keys recursively (plain objects only)
 * - Prevents prototype pollution keys
 * - Preserves existing unrelated keys
 */

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isPlainObject(x: unknown): x is Record<string, unknown> {
  if (!x || typeof x !== "object") return false;
  const proto = Object.getPrototypeOf(x);
  return proto === Object.prototype || proto === null;
}

export function deepMergeSafe(base: unknown, patch: unknown): unknown {
  if (Array.isArray(base) && Array.isArray(patch)) {
    // arrays: patch replaces base (predictable)
    return patch.slice();
  }
  if (isPlainObject(base) && isPlainObject(patch)) {
    const out: Record<string, unknown> = {
      ...(base as Record<string, unknown>),
    };
    for (const [k, v] of Object.entries(patch)) {
      if (FORBIDDEN_KEYS.has(k)) continue;
      const bv = (base as Record<string, unknown>)[k];
      out[k] = deepMergeSafe(bv, v);
    }
    return out;
  }
  // primitives or mismatched types: patch wins
  return patch;
}

export function applyJsonMerge(
  oldText: string | null | undefined,
  patchObj: unknown,
  createIfMissing: boolean,
): {
  ok: boolean;
  nextText: string;
  error?: string;
} {
  const raw = (oldText ?? "").trim();
  if (!raw) {
    if (!createIfMissing)
      return {
        ok: false,
        nextText: "",
        error: "File missing/empty and createIfMissing=false",
      };
    const merged = deepMergeSafe({}, patchObj);
    return { ok: true, nextText: JSON.stringify(merged, null, 2) + "\n" };
  }
  try {
    const base = JSON.parse(raw) as unknown;
    const merged = deepMergeSafe(base, patchObj);
    return { ok: true, nextText: JSON.stringify(merged, null, 2) + "\n" };
  } catch (e: any) {
    if (!createIfMissing)
      return { ok: false, nextText: "", error: e?.message || "Invalid JSON" };
    const merged = deepMergeSafe({}, patchObj);
    return { ok: true, nextText: JSON.stringify(merged, null, 2) + "\n" };
  }
}
