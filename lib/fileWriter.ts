import { ProjectFile } from "../contexts/types";
import { normalizePath } from "../utils/chatUtils";
import { CONFIG } from "../config";
import { validateFilePath, validateFileContent } from "./validators";

/**
 * FileWriter System
 * ---------------------------------------------------------
 * ✓ aktualisiert existierende Dateien
 * ✓ erzeugt neue Dateien
 * ✓ verhindert gefährliche Überschreibungen
 * ✓ liefert klare Rückgabewerte:
 *    { created: [], updated: [], skipped: [] }
 */

// ✅ FIXED: Nutze CONFIG statt hardcodierte Liste
const PROTECTED_FILES = new Set<string>([
  "app.config.js",
  "eas.json",
  "metro.config.js",
  "package.json",
  "tsconfig.json",
  "config.ts",
  "theme.ts",
  ...CONFIG.PATHS.ALLOWED_ROOT.filter(f => 
    f.endsWith('.json') || f.endsWith('.js') || f.endsWith('.ts')
  ),
]);

export function applyFilesToProject(
  existing: ProjectFile[],
  incoming: ProjectFile[],
) {
  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];

  const mapExisting = new Map(existing.map((f) => [f.path, f.content]));
  const result: ProjectFile[] = [...existing];

  for (const f of incoming) {
    // ✅ SICHERHEIT: Pfad validieren bevor Verarbeitung
    const pathValidation = validateFilePath(f.path);
    if (!pathValidation.valid) {
      console.warn(
        `[FileWriter] Pfad übersprungen: ${f.path}`,
        pathValidation.errors
      );
      skipped.push(f.path);
      continue;
    }

    // ✅ SICHERHEIT: Content-Größe validieren
    const contentValidation = validateFileContent(f.content);
    if (!contentValidation.valid) {
      console.warn(
        `[FileWriter] Content übersprungen: ${f.path} - ${contentValidation.error}`,
        `Größe: ${contentValidation.sizeMB}MB`
      );
      skipped.push(f.path);
      continue;
    }

    // Normalisiere Pfad für konsistente Verarbeitung
    const path = pathValidation.normalized || normalizePath(f.path);

    // Sicherheitsregel: bestimmte Kern-Dateien niemals automatisch überschreiben
    if (PROTECTED_FILES.has(path)) {
      console.log(`[FileWriter] Geschützte Datei übersprungen: ${path}`);
      skipped.push(path);
      continue;
    }

    if (mapExisting.has(path)) {
      // Update nur bei unterschiedlichem Inhalt
      if (mapExisting.get(path) !== f.content) {
        updated.push(path);
        const idx = result.findIndex((x) => x.path === path);
        if (idx !== -1) {
          result[idx] = { ...f, path }; // Verwende normalisierten Pfad
        }
      } else {
        skipped.push(path);
      }
    } else {
      created.push(path);
      result.push({ ...f, path }); // Verwende normalisierten Pfad
    }
  }

  return {
    created,
    updated,
    skipped,
    files: result,
  };
}
