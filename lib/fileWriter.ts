// lib/fileWriter.ts
import { ProjectFile } from '../contexts/types';
import { validateFileContent, validateFilePath, normalizePath } from './validators';

/**
 * FileWriter System
 * ---------------------------------------------------------
 * - merged incoming files into existing project files
 * - protects critical config files from being overwritten
 * - validates paths + content size
 * - ✅ optional: verhindert „Fantasie-Dateien“ (neue Dateien müssen i.d.R. eingebunden sein)
 */

const PROTECTED_FROM_OVERWRITE = new Set<string>([
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

const CODE_EXTS = ['.ts', '.tsx', '.js', '.jsx'] as const;

function stripExt(path: string): string {
  const m = path.match(/^(.*)\.(ts|tsx|js|jsx|json|md|yml|yaml|d\.ts)$/);
  return m ? m[1] : path.replace(/\.[^.]+$/, '');
}

function dirname(path: string): string {
  const p = normalizePath(path);
  const idx = p.lastIndexOf('/');
  return idx >= 0 ? p.slice(0, idx) : '';
}

function relativePath(fromDir: string, toPathNoExt: string): string {
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

function buildImportSpecifiers(fromFilePath: string, newFilePath: string): string[] {
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

function isLikelyCodeFile(path: string): boolean {
  return CODE_EXTS.some((ext) => path.endsWith(ext));
}

function isReferencedByAnyOtherIncoming(newPath: string, incoming: ProjectFile[]): boolean {
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

    // schnell: wenn absoluter Pfad ohne Extension drin ist, ist das oft schon genug
    if (content.includes(stripExt(newPathNorm))) return true;

    for (const spec of specs) {
      if (quotedRe(spec).test(content)) return true;
    }
  }

  return false;
}

export function applyFilesToProject(existing: ProjectFile[], incoming: ProjectFile[]): ApplyFilesResult {
  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  const existingMap = new Map<string, ProjectFile>();
  for (const f of existing ?? []) {
    const p = normalizePath(f.path);
    existingMap.set(p, { path: p, content: f.content ?? '' });
  }

  const resultMap = new Map(existingMap);
  const isBootstrap = existingMap.size === 0;

  for (const file of incoming ?? []) {
    const rawPath = typeof file?.path === 'string' ? file.path : String(file?.path ?? '');
    const rawContent = typeof file?.content === 'string' ? file.content : String(file?.content ?? '');

    const p = normalizePath(rawPath);

    // Validate path
    const pathRes = validateFilePath(p);
    if (!pathRes.valid || !pathRes.normalized) {
      skipped.push(p || rawPath || '(leer)');
      errors.push(`Ungültiger Pfad: ${rawPath}`);
      continue;
    }
    const path = pathRes.normalized;

    // Validate content
    const contentRes = validateFileContent(rawContent);
    if (!contentRes.valid) {
      skipped.push(path);
      errors.push(`Ungültiger Content: ${path} (${contentRes.error})`);
      continue;
    }

    const already = resultMap.get(path);

    // Protect overwrites
    if (already && PROTECTED_FROM_OVERWRITE.has(path)) {
      skipped.push(path);
      continue;
    }

    // NEW FILE: block "phantom" files unless they are also used/linked in the same change-set
    if (!already) {
      const needsReference = isLikelyCodeFile(path);
      const referenced = !needsReference || isBootstrap ? true : isReferencedByAnyOtherIncoming(path, incoming);

      if (!referenced) {
        skipped.push(path);
        errors.push(
          `Neue Datei wurde übersprungen (nicht eingebunden): ${path}. ` +
            `Wenn du sie wirklich willst, muss eine bestehende Datei sie importieren/verwenden.`
        );
        continue;
      }

      resultMap.set(path, { path, content: rawContent });
      created.push(path);
      continue;
    }

    // Update only when content differs
    if ((already.content ?? '') !== rawContent) {
      resultMap.set(path, { path, content: rawContent });
      updated.push(path);
    } else {
      skipped.push(path);
    }
  }

  return {
    files: Array.from(resultMap.values()),
    created,
    updated,
    skipped,
    errors: errors.length ? errors : undefined,
  };
}
