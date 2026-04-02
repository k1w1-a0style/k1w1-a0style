// lib/diagnostics/preflightHelpers.ts
// Shared helpers for preflight checks — extracted from preflightChecks.ts.

import type { ProjectFile } from "../../shared/types/project";
import type {
  PreflightCheckResult,
  PreflightPatch,
  PreflightSeverity,
  PreflightStatus,
} from "./preflightTypes";

export const normalizePath = (p: string) =>
  p.replace(/\\/g, "/").replace(/^\.?\//, "");

export const byPath = (files: ProjectFile[]) => {
  const map = new Map<string, ProjectFile>();
  for (const f of files) map.set(normalizePath(f.path), f);
  return map;
};

export const has = (m: Map<string, ProjectFile>, p: string) => m.has(normalizePath(p));

export const getText = (m: Map<string, ProjectFile>, p: string) =>
  m.get(normalizePath(p))?.content ?? "";

export const ok = (
  res: Omit<PreflightCheckResult, "status"> & { status?: PreflightStatus },
): PreflightCheckResult => ({
  status: res.status ?? "pass",
  ...res,
});

export function mkFix(
  upsert: Array<{ path: string; content: string }>,
  del: string[] = [],
  label = "Fix anwenden",
): PreflightPatch {
  return { upsert, delete: del, explanation: label };
}

export function mkJsonFix(
  jsonMerge: Array<{ path: string; patch: unknown; createIfMissing?: boolean }>,
  del: string[] = [],
  label = "Fix anwenden",
): PreflightPatch {
  return { jsonMerge, delete: del, explanation: label };
}

export function existsAny(
  m: Map<string, ProjectFile>,
  paths: string[],
): string | null {
  for (const p of paths) if (has(m, p)) return normalizePath(p);
  return null;
}

export function parseJson<T = unknown>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function statusBySeverity(sev: PreflightSeverity): PreflightStatus {
  return sev === "critical"
    ? "fail"
    : sev === "high"
      ? "fail"
      : sev === "normal"
        ? "warn"
        : "warn";
}

// --- helpers for warn autofix

export function ensureEndsWithNewline(s: string): string {
  return s.endsWith("\n") ? s : s + "\n";
}

export function normalizeGitignoreEntry(entry: string): string {
  const e = String(entry ?? "").trim();
  if (!e) return "";
  // keep as-is except ensure folders end with "/"
  if (e.endsWith("/") || e.includes("*") || e.includes("!")) return e;
  // for typical folder patterns like node_modules or .expo, prefer trailing slash
  if (!e.includes(".") || e.startsWith("."))
    return e.endsWith("/") ? e : `${e}/`;
  return e;
}

export function gitignoreAppendMissing(existing: string, misses: string[]): string {
  const lines = (existing ?? "").split(/\r?\n/);

  const normalizedExisting = new Set(
    lines
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"))
      .flatMap((l) => {
        const a = l;
        const b = l.endsWith("/") ? l.slice(0, -1) : `${l}/`;
        return [a, b];
      }),
  );

  const out = [...lines];
  let changed = false;

  for (const raw of misses) {
    const norm = normalizeGitignoreEntry(raw);
    if (!norm) continue;

    const a = norm;
    const b = norm.endsWith("/") ? norm.slice(0, -1) : `${norm}/`;

    if (normalizedExisting.has(a) || normalizedExisting.has(b)) continue;

    out.push(a);
    normalizedExisting.add(a);
    normalizedExisting.add(b);
    changed = true;
  }

  const joined = out.join("\n");
  return changed
    ? ensureEndsWithNewline(joined)
    : ensureEndsWithNewline(existing ?? "");
}

export function npmrcLockfileSetting(content: string): boolean | null {
  // returns:
  //   true  -> package-lock=true/1
  //   false -> package-lock=false/0
  //   null  -> not set
  const c = String(content ?? "");
  const re = /(^|\n)\s*package-lock\s*=\s*(true|false|1|0)\s*(\n|$)/im;
  const m = c.match(re);
  if (!m) return null;
  const v = String(m[2]).toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return null;
}
