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
