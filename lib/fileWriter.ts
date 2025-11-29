import { ProjectFile } from "../contexts/types";

/**
 * FileWriter System
 * ---------------------------------------------------------
 * ✓ aktualisiert existierende Dateien
 * ✓ erzeugt neue Dateien
 * ✓ verhindert gefährliche Überschreibungen
 * ✓ liefert klare Rückgabewerte:
 *    { created: [], updated: [], skipped: [] }
 */

const PROTECTED_FILES = new Set<string>([
  "app.config.js",
  "eas.json",
  "metro.config.js",
  "package.json",
  "tsconfig.json",
  "config.ts",
  "theme.ts",
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
    const path = f.path;

    // Sicherheitsregel: bestimmte Kern-Dateien niemals automatisch überschreiben
    if (PROTECTED_FILES.has(path)) {
      skipped.push(path);
      continue;
    }

    if (mapExisting.has(path)) {
      // Update nur bei unterschiedlichem Inhalt
      if (mapExisting.get(path) !== f.content) {
        updated.push(path);
        const idx = result.findIndex((x) => x.path === path);
        if (idx !== -1) {
          result[idx] = f;
        }
      } else {
        skipped.push(path);
      }
    } else {
      created.push(path);
      result.push(f);
    }
  }

  return {
    created,
    updated,
    skipped,
    files: result,
  };
}
