// lib/diagnostics/smartPatch.ts

/**
 * Apply a "smart" JSON merge patch.
 * - Merges keys recursively (plain objects only)
 * - Prevents prototype pollution keys
 * - Preserves existing unrelated keys
 * - Caps merge depth/size to prevent pathological patches (DoS)
 */

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

// Caps to prevent pathological patches from exploding CPU/RAM.
// These numbers are generous for app configs, but stop abuse.
const MAX_MERGE_DEPTH = 40;
const MAX_MERGE_KEYS = 20_000;

type MergeState = { keys: number };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== "object") return false;
  if (Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function deepMergeImpl(
  base: unknown,
  patch: unknown,
  depth: number,
  state: MergeState,
): unknown {
  if (depth > MAX_MERGE_DEPTH) {
    throw new Error(`JSON merge patch zu tief (>${MAX_MERGE_DEPTH})`);
  }

  // If patch is not a plain object, patch wins (including arrays, primitives).
  if (!isPlainObject(patch)) return patch;

  const out: Record<string, unknown> = isPlainObject(base) ? { ...base } : {};

  for (const [key, patchVal] of Object.entries(patch)) {
    state.keys += 1;
    if (state.keys > MAX_MERGE_KEYS) {
      throw new Error(`JSON merge patch zu groß (>${MAX_MERGE_KEYS} keys)`);
    }

    if (FORBIDDEN_KEYS.has(key)) continue;

    const baseVal = (out as Record<string, unknown>)[key];

    if (patchVal === null) {
      // In merge-patch semantics, null deletes the key.
      delete (out as Record<string, unknown>)[key];
      continue;
    }

    if (isPlainObject(baseVal) && isPlainObject(patchVal)) {
      (out as Record<string, unknown>)[key] = deepMergeImpl(
        baseVal,
        patchVal,
        depth + 1,
        state,
      );
      continue;
    }

    // For arrays / primitives / non-plain objects: patch wins.
    (out as Record<string, unknown>)[key] = patchVal as unknown;
  }

  return out;
}

/** Exported helper used by other modules. */
export function deepMergeSafe(base: unknown, patch: unknown): unknown {
  return deepMergeImpl(base, patch, 0, { keys: 0 });
}

export type JsonMergeResult =
  | { ok: true; nextText: string; nextObj: unknown }
  | { ok: false; error: string };

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Apply JSON merge patch on a JSON text.
 * - If createIfMissing is false and baseText is empty/missing → error.
 */
export function applyJsonMerge(
  baseText: string,
  patch: unknown,
  createIfMissing = false,
): JsonMergeResult {
  const trimmed = (baseText ?? "").trim();
  if (!trimmed) {
    if (!createIfMissing) return { ok: false, error: "Missing JSON content" };
  }

  let baseObj: unknown = {};
  if (trimmed) {
    try {
      baseObj = JSON.parse(trimmed);
    } catch (e: unknown) {
      return {
        ok: false,
        error: `Invalid JSON: ${getErrorMessage(e, "parse failed")}`,
      };
    }
  }

  try {
    const nextObj = deepMergeSafe(baseObj, patch);
    const nextText = JSON.stringify(nextObj, null, 2) + "\n";
    return { ok: true, nextText, nextObj };
  } catch (e: unknown) {
    return { ok: false, error: getErrorMessage(e, "Merge failed") };
  }
}

/**
 * Apply multiple jsonMerge patches to a set of files.
 * Used by Diagnostics to safely realize patch.jsonMerge.
 */
export async function applyJsonMergePatchSafe(
  files: Array<{ path: string; content: string }>,
  patches: Array<{ path: string; patch: unknown; createIfMissing?: boolean }>,
): Promise<Array<{ path: string; content: string }>> {
  const result = [...files];

  for (const jp of patches) {
    const idx = result.findIndex((f) => f.path === jp.path);

    if (idx === -1) {
      if (!jp.createIfMissing) continue;

      // create new file from empty object
      const merged = deepMergeSafe({}, jp.patch);
      result.push({
        path: jp.path,
        content: JSON.stringify(merged, null, 2) + "\n",
      });
      continue;
    }

    const file = result[idx];
    const applyResult = applyJsonMerge(
      file.content,
      jp.patch,
      Boolean(jp.createIfMissing),
    );
    if (!applyResult.ok) {
      throw new Error(applyResult.error || `JSON merge failed for ${jp.path}`);
    }

    result[idx] = { path: jp.path, content: applyResult.nextText };
  }

  return result;
}
