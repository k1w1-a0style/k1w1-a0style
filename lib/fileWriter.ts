// lib/fileWriter.ts
// REFACTORED: helpers → fileWriterHelpers.ts

// lib/fileWriter.ts

import { validateFileContent, validateFilePath, normalizePath } from './validators';

import type { ProjectFile } from '../shared/types/project';

/**
 * FileWriter System
 * ---------------------------------------------------------
 * - merged incoming files into existing project files
 * - protects critical config files from being overwritten
 * - validates paths + content size
 * - ✅ optional: verhindert „Fantasie-Dateien“ (neue Dateien müssen i.d.R. eingebunden sein)
 */

import {
  PROTECTED_FROM_OVERWRITE, CODE_EXTS, stripExt, dirname,
  relativePath, buildImportSpecifiers, isLikelyCodeFile,
  isReferencedByAnyOtherIncoming, isReferencedByAnyExisting,
} from "./fileWriterHelpers";


export type ApplyFilesResult = {
  files: ProjectFile[];
  created: string[];
  updated: string[];
  skipped: string[];
  errors?: string[];
};

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
      const referenced =
        !needsReference || isBootstrap
          ? true
          : isReferencedByAnyOtherIncoming(path, incoming) ||
            isReferencedByAnyExisting(path, existing ?? []);

      if (!referenced) {
        // ⚠️ Nicht mehr silent droppen: Datei wird geschrieben, aber wir warnen explizit.
        // Hintergrund: Ein "silent drop" ist Debug-Hölle (Datei fehlt später ohne Hinweis).
        errors.push(
          `Neue Datei ist nicht eingebunden: ${path}. ` +
            `Sie wurde trotzdem übernommen. Wenn das unerwünscht ist, entferne sie oder binde sie sauber ein.`
        );
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
