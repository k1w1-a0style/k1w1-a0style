// lib/fileWriterHelpers.ts
// Extracted from fileWriter.ts: private helper functions.

import { normalizePath } from './validators';

import type { ProjectFile } from '../shared/types/project';

/**
 * FileWriter System
 * ---------------------------------------------------------
 * - merged incoming files into existing project files
 * - protects critical config files from being overwritten
 * - validates paths + content size
 * - ✅ optional: verhindert „Fantasie-Dateien“ (neue Dateien müssen i.d.R. eingebunden sein)
 */


export const PROTECTED_FROM_OVERWRITE = new Set<string>([
  'app.config.js',
  'eas.json',
  'metro.config.js',
  'package.json',
  'tsconfig.json',
  'config.ts',
  'theme.ts',
]);

export type ApplyFilesResult = {
  files: ProjectFile[];
  created: string[];
  updated: string[];
  skipped: string[];
  errors?: string[];
};

export const CODE_EXTS = ['.ts', '.tsx', '.js', '.jsx'] as const;

export function stripExt(path: string): string {
  const m = path.match(/^(.*)\.(ts|tsx|js|jsx|json|md|yml|yaml|d\.ts)$/);
  return m ? m[1] : path.replace(/\.[^.]+$/, '');
}

export function dirname(path: string): string {
  const p = normalizePath(path);
  const idx = p.lastIndexOf('/');
  return idx >= 0 ? p.slice(0, idx) : '';
}

export function relativePath(fromDir: string, toPathNoExt: string): string {
  const from = normalizePath(fromDir).split('/').filter(Boolean);
  const to = normalizePath(toPathNoExt).split('/').filter(Boolean);

  let i = 0;
  while (i < from.length && i < to.length && from[i] === to[i]) i++;

  const ups = from.length - i;
  const rest = to.slice(i);

  const parts: string[] = [];
  for (let k = 0; k < ups; k++) parts.push('..');
  parts.push(...rest);

  const joined = parts.join('/');
  if (!joined) return '.';
  return joined.startsWith('..') ? joined : `./${joined}`;
}

export function buildImportSpecifiers(fromFilePath: string, newFilePath: string): string[] {
  const fromDir = dirname(fromFilePath);
  const newNoExt = stripExt(newFilePath);

  const rel = relativePath(fromDir, newNoExt);
  const abs = newNoExt;

  const specs = new Set<string>([
    rel,
    abs,
    `${rel}.ts`,
    `${rel}.tsx`,
    `${rel}.js`,
    `${rel}.jsx`,
    `${abs}.ts`,
    `${abs}.tsx`,
    `${abs}.js`,
    `${abs}.jsx`,
  ]);

  return Array.from(specs).filter(Boolean);
}

export function isLikelyCodeFile(path: string): boolean {
  return CODE_EXTS.some((ext) => path.endsWith(ext));
}

export function isReferencedByAnyOtherIncoming(newPath: string, incoming: ProjectFile[]): boolean {
  const newPathNorm = normalizePath(newPath);
  const candidatesByFrom = new Map<string, string[]>();

  for (const f of incoming ?? []) {
    const fromPath = normalizePath(String(f?.path ?? ''));
    if (!fromPath || fromPath === newPathNorm) continue;
    candidatesByFrom.set(fromPath, buildImportSpecifiers(fromPath, newPathNorm));
  }

  const quotedRe = (spec: string) =>
    new RegExp(`['"]${spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'm');

  for (const f of incoming ?? []) {
    const fromPath = normalizePath(String(f?.path ?? ''));
    if (!fromPath || fromPath === newPathNorm) continue;

    const content = typeof f?.content === 'string' ? f.content : String(f?.content ?? '');
    const specs = candidatesByFrom.get(fromPath) ?? [];

    for (const spec of specs) {
      if (quotedRe(spec).test(content)) return true;
    }
  }

  return false;
}

export function isReferencedByAnyExisting(newPath: string, existing: ProjectFile[]): boolean {
  const newPathNorm = normalizePath(newPath);

  const quotedRe = (spec: string) =>
    new RegExp(`['"]${spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'm');

  for (const f of existing ?? []) {
    const fromPath = normalizePath(String(f?.path ?? ''));
    if (!fromPath || fromPath === newPathNorm) continue;

    const content = typeof f?.content === 'string' ? f.content : String(f?.content ?? '');
    if (!content) continue;

    const specs = buildImportSpecifiers(fromPath, newPathNorm);
    for (const spec of specs) {
      if (quotedRe(spec).test(content)) return true;
    }
  }
  return false;
}

