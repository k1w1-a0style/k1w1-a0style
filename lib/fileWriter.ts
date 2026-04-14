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
import { canActorModifyPath } from "./projectOwnership";


export type ApplyFilesResult = {
  files: ProjectFile[];
  created: string[];
  updated: string[];
  skipped: string[];
  deleted?: string[];
  renamed?: Array<{ from: string; to: string }>;
  errors?: string[];
};

export type FileMutationOps = {
  deletePaths?: string[];
  renames?: Array<{ from: string; to: string }>;
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

    const ownershipDecision = canActorModifyPath("chat", path);
    if (!ownershipDecision.allowed) {
      skipped.push(path);
      errors.push(ownershipDecision.reason ?? `Ownership block: ${path}`);
      continue;
    }

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

export function applyFileOpsToProject(
  existing: ProjectFile[],
  incoming: ProjectFile[],
  ops?: FileMutationOps,
): ApplyFilesResult {
  const skipped: string[] = [];
  const errors: string[] = [];
  const normalizedDeletes = Array.from(
    new Set(
      (ops?.deletePaths ?? [])
        .map((p) => normalizePath(String(p ?? "")))
        .filter(Boolean),
    ),
  );
  const normalizedRenames = (ops?.renames ?? [])
    .map((entry) => ({
      from: normalizePath(String(entry?.from ?? "")),
      to: normalizePath(String(entry?.to ?? "")),
    }))
    .filter((entry): entry is { from: string; to: string } => Boolean(entry.from && entry.to && entry.from !== entry.to));

  if (normalizedDeletes.length === 0 && normalizedRenames.length === 0) {
    return applyFilesToProject(existing, incoming);
  }

  const working = new Map<string, ProjectFile>();
  for (const file of existing ?? []) {
    const path = normalizePath(String(file.path ?? ""));
    if (!path) continue;
    working.set(path, { path, content: String(file.content ?? "") });
  }

  const canApplyPathOp = (
    path: string,
    opLabel: "delete" | "rename-source" | "rename-target",
  ): boolean => {
    const validation = validateFilePath(path);
    if (!validation.valid || !validation.normalized) {
      skipped.push(path);
      errors.push(`Ungültiger Pfad für ${opLabel}: ${path}`);
      return false;
    }

    const normalized = validation.normalized;
    const ownership = canActorModifyPath("chat", normalized);
    if (!ownership.allowed) {
      skipped.push(normalized);
      errors.push(ownership.reason ?? `Ownership block (${opLabel}): ${normalized}`);
      return false;
    }

    if (PROTECTED_FROM_OVERWRITE.has(normalized)) {
      skipped.push(normalized);
      errors.push(`Geschützter Pfad darf nicht per ${opLabel} geändert werden: ${normalized}`);
      return false;
    }

    return true;
  };

  const deleted: string[] = [];
  for (const path of normalizedDeletes) {
    if (!working.has(path)) {
      skipped.push(path);
      continue;
    }
    if (!canApplyPathOp(path, "delete")) continue;
    working.delete(path);
    deleted.push(path);
  }

  const renamed: Array<{ from: string; to: string }> = [];
  for (const rename of normalizedRenames) {
    if (!working.has(rename.from)) {
      skipped.push(rename.from);
      continue;
    }
    if (!canApplyPathOp(rename.from, "rename-source")) continue;
    if (!canApplyPathOp(rename.to, "rename-target")) continue;
    if (working.has(rename.to)) {
      skipped.push(`${rename.from} -> ${rename.to}`);
      errors.push(`Rename-Konflikt: Zielpfad existiert bereits (${rename.to}); Quelle bleibt erhalten.`);
      continue;
    }

    const source = working.get(rename.from);
    if (!source) {
      skipped.push(rename.from);
      continue;
    }

    // Move only after all validations passed; prevents source data loss on conflict.
    working.set(rename.to, { path: rename.to, content: source.content });
    working.delete(rename.from);
    renamed.push({ from: rename.from, to: rename.to });
  }

  const merged = applyFilesToProject(Array.from(working.values()), incoming);

  return {
    ...merged,
    skipped: [...merged.skipped, ...skipped],
    deleted: [...(merged.deleted ?? []), ...deleted],
    renamed: [...(merged.renamed ?? []), ...renamed],
    errors: [...(merged.errors ?? []), ...errors].length
      ? [...(merged.errors ?? []), ...errors]
      : undefined,
  };
}
