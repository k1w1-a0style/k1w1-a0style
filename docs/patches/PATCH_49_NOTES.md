# PATCH 49 – CodeScreen: FileActions Pre-Validation + No Ghost Selection

Datum: 2026-02-10

## Ziel
Kleine, aber wichtige Konsistenz-Härtung: Wenn `createFile`/`renameFile` im `ProjectContext` wegen Validation/Kollision abbricht, darf der UI-State nicht so tun, als wäre die Datei bereits erstellt/verschoben.

## Änderungen
- `useFileActions`
  - `handleCreateFile` ist jetzt `async` und prüft:
    - `validateFilePath(finalPath)` (UI-Precheck + Alert)
    - Kollision gegen `projectData.files`
  - `handleRenameFile` + `handleMoveFile` analog:
    - Path-Precheck + Kollision-Check
    - `await renameFile(...)` bevor `selectedFile` umgestellt wird

## Warum
- Verhindert **Ghost-Selection** / State-Divergenz: “Datei ausgewählt”, aber Create/Rename wurde vom Context verworfen.
- Vermeidet doppelte Fehlermeldungen (UI fängt die häufigsten Fälle ab, Context bleibt trotzdem die Source of Truth).

## Betroffene Dateien
- `screens/CodeScreen/hooks/useFileActions.ts`
- `docs/TODO.md`
- `docs/patches/PATCH_49_NOTES.md`
- `PROJECT_CHECKLOG.md`
