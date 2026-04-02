# Patch 700 - PatchEngine Pfad-Haertung (Windows + Mixed Separators)

Datum: 2026-04-02

## Kontext
Patch 699 fuehrte Basisschutz fuer `applyPatch(...)` ein. Als P1-Nebenfund blieb offen, dass die Traversal-Erkennung nur Slash-seitig war (`split("/")`) und damit Windows-/Mixed-Separatoren nicht vollstaendig erfasste.

## Befund
- Windows-Traversal (`..\\...`) wurde nicht explizit als Traversal segmentiert.
- Absolute Windows-Pfade (`C:\\...`) waren nicht als unsicher markiert.
- UNC-/Backslash-root-Pfade (`\\server\\...`) waren nicht explizit ausgeschlossen.

## Fix
- `isUnsafePatchPath(...)` behandelt jetzt zusaetzlich:
  - Null-Byte-Pfade,
  - absolute POSIX-/UNC-/Backslash-root-Pfade,
  - Windows-Drive-absolute Pfade (`^[A-Za-z]:[\\/]`),
  - Traversal ueber normalisierte Separatoren (`\\` -> `/`).
- Regressionen in `__tests__/patchEngine.pathSafety.test.ts` erweitert:
  - `..\\secrets.txt` wird geblockt,
  - `C:\\temp\\secret.txt` wird geblockt.

## Validierung
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/patchEngine.pathSafety.test.ts`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
