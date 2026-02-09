import type { PreflightPatch } from "./preflightTypes";

// Safety helpers for batch fix runners (AutoFix / Smart Fix / Apply Selected).
// Goal: prevent "silent" high-impact changes without at least one explicit confirmation.

export type PatchRisk = {
  opCount: number;
  touchedCount: number;
  deletesCount: number;
  riskyPaths: string[];
  reasons: string[];
};

export type PatchMagnitude = {
  opCount: number;
  touchedCount: number;
  charCount: number;
  jsonMergeCount: number;
};

export type PatchLimits = {
  /** warn (confirm) if patch text exceeds this */
  softMaxChars: number;
  /** warn (confirm) if touched files exceed this */
  softMaxTouched: number;
  /** warn (confirm) if operation count exceeds this */
  softMaxOps: number;
  /** block if patch text exceeds this */
  hardMaxChars: number;
  /** block if touched files exceed this */
  hardMaxTouched: number;
  /** block if operation count exceeds this */
  hardMaxOps: number;
};

export const DEFAULT_PATCH_LIMITS: PatchLimits = {
  softMaxChars: 80_000,
  softMaxTouched: 20,
  softMaxOps: 30,
  hardMaxChars: 250_000,
  hardMaxTouched: 60,
  hardMaxOps: 120,
};

// Paths that are typically "high impact" in this repo.
// Editing them can break CI/build/release pipelines, so we require extra confirmation in batch mode.
const RISKY_PREFIXES = [
  ".github/workflows/",
  ".github/actions/",
  "android/",
  "ios/",
  "supabase/",
];

const RISKY_FILES = new Set([
  "package.json",
  "package-lock.json",
  "eas.json",
  "app.config.js",
  "android/app/build.gradle",
  "README.md",
  "README_EXTENDED.md",
]);

function isRiskyPath(path: string): boolean {
  if (RISKY_FILES.has(path)) return true;
  return RISKY_PREFIXES.some((p) => path.startsWith(p));
}

export function patchTouchedPaths(patch: PreflightPatch): string[] {
  const paths = new Set<string>();
  for (const u of patch.upsert ?? []) paths.add(u.path);
  for (const p of patch.delete ?? []) paths.add(p);
  for (const j of patch.jsonMerge ?? []) paths.add(j.path);
  return Array.from(paths).sort();
}

export function patchFingerprint(patch: PreflightPatch): string {
  // Short stable fingerprint for de-duplication in batch mode.
  // We intentionally avoid including full content to keep it cheap.
  const upsert = patch.upsert?.length ?? 0;
  const del = patch.delete?.length ?? 0;
  const jm = patch.jsonMerge?.length ?? 0;
  const touched = patchTouchedPaths(patch);
  return `${upsert}:${del}:${jm}:${touched.join("|")}`;
}

export function analyzePatchRisk(patch: PreflightPatch): PatchRisk {
  const touched = patchTouchedPaths(patch);
  const deletes = patch.delete ?? [];

  const opCount = (patch.upsert?.length ?? 0) + (patch.jsonMerge?.length ?? 0) + deletes.length;
  const riskyPaths = touched.filter(isRiskyPath);

  const reasons: string[] = [];
  if (deletes.length > 0) reasons.push(`deletes ${deletes.length} file(s)`);
  if (riskyPaths.length > 0) reasons.push(`touches high-impact paths (${riskyPaths.length})`);
  if (opCount >= 10) reasons.push(`large patch (${opCount} ops)`);

  return {
    opCount,
    touchedCount: touched.length,
    deletesCount: deletes.length,
    riskyPaths,
    reasons,
  };
}

export function estimatePatchCharCount(patch: PreflightPatch): number {
  let n = 0;
  for (const u of patch.upsert ?? []) n += u.content?.length ?? 0;
  for (const j of patch.jsonMerge ?? []) {
    try {
      n += JSON.stringify(j.patch)?.length ?? 0;
    } catch {
      // best effort
      n += 0;
    }
  }
  if (patch.explanation) n += patch.explanation.length;
  return n;
}

export function analyzePatchMagnitude(patch: PreflightPatch): PatchMagnitude {
  const deletes = patch.delete ?? [];
  const opCount = (patch.upsert?.length ?? 0) + (patch.jsonMerge?.length ?? 0) + deletes.length;
  const touchedCount = patchTouchedPaths(patch).length;
  const charCount = estimatePatchCharCount(patch);
  return {
    opCount,
    touchedCount,
    charCount,
    jsonMergeCount: patch.jsonMerge?.length ?? 0,
  };
}

export type PatchLimitCheck = {
  hardFail: boolean;
  softWarn: boolean;
  reasons: string[];
  magnitude: PatchMagnitude;
};

export function checkPatchLimits(patch: PreflightPatch, limits: PatchLimits = DEFAULT_PATCH_LIMITS): PatchLimitCheck {
  const mag = analyzePatchMagnitude(patch);
  const reasons: string[] = [];

  const hardReasons: string[] = [];
  if (mag.charCount > limits.hardMaxChars) hardReasons.push(`patch size ${mag.charCount} chars > ${limits.hardMaxChars}`);
  if (mag.touchedCount > limits.hardMaxTouched) hardReasons.push(`touched ${mag.touchedCount} files > ${limits.hardMaxTouched}`);
  if (mag.opCount > limits.hardMaxOps) hardReasons.push(`ops ${mag.opCount} > ${limits.hardMaxOps}`);

  const softReasons: string[] = [];
  if (mag.charCount > limits.softMaxChars) softReasons.push(`large patch (${mag.charCount} chars)`);
  if (mag.touchedCount > limits.softMaxTouched) softReasons.push(`many files (${mag.touchedCount})`);
  if (mag.opCount > limits.softMaxOps) softReasons.push(`many operations (${mag.opCount})`);

  if (hardReasons.length) reasons.push(...hardReasons);
  else if (softReasons.length) reasons.push(...softReasons);

  return {
    hardFail: hardReasons.length > 0,
    softWarn: !hardReasons.length && softReasons.length > 0,
    reasons,
    magnitude: mag,
  };
}

export function summarizeBatchRisk(items: Array<{ title: string; patch: PreflightPatch }>, maxPaths = 6) {
  const risky: Array<{ title: string; risk: PatchRisk }> = [];
  const allRiskyPaths = new Set<string>();

  for (const it of items) {
    const risk = analyzePatchRisk(it.patch);
    if (risk.reasons.length) {
      risky.push({ title: it.title, risk });
      for (const p of risk.riskyPaths) allRiskyPaths.add(p);
    }
  }

  const riskyPaths = Array.from(allRiskyPaths).sort();

  const shortPaths = riskyPaths.slice(0, maxPaths);
  const more = riskyPaths.length > maxPaths ? ` (+${riskyPaths.length - maxPaths} more)` : "";

  return {
    risky,
    riskyPaths,
    shortPaths,
    more,
    hasRisk: risky.length > 0,
  };
}

export function summarizeBatchLimits(
  items: Array<{ title: string; patch: PreflightPatch }>,
  limits: PatchLimits = DEFAULT_PATCH_LIMITS,
) {
  const hard: Array<{ title: string; reasons: string[] }> = [];
  const soft: Array<{ title: string; reasons: string[] }> = [];
  const maxMag: PatchMagnitude = { opCount: 0, touchedCount: 0, charCount: 0, jsonMergeCount: 0 };

  for (const it of items) {
    const check = checkPatchLimits(it.patch, limits);
    maxMag.opCount = Math.max(maxMag.opCount, check.magnitude.opCount);
    maxMag.touchedCount = Math.max(maxMag.touchedCount, check.magnitude.touchedCount);
    maxMag.charCount = Math.max(maxMag.charCount, check.magnitude.charCount);
    maxMag.jsonMergeCount = Math.max(maxMag.jsonMergeCount, check.magnitude.jsonMergeCount);

    if (check.hardFail) hard.push({ title: it.title, reasons: check.reasons });
    else if (check.softWarn) soft.push({ title: it.title, reasons: check.reasons });
  }

  const hardLines = hard.slice(0, 3).map((h) => `- ${h.title}: ${h.reasons.join(", ")}`);
  const softLines = soft.slice(0, 3).map((s) => `- ${s.title}: ${s.reasons.join(", ")}`);

  return {
    hard,
    soft,
    hasHard: hard.length > 0,
    hasSoft: soft.length > 0,
    hardLines,
    softLines,
    maxMagnitude: maxMag,
  };
}

