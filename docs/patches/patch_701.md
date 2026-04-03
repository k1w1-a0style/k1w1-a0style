# Patch 701 - PatchEngine Path-Safety Follow-up (Drive-relative, UNC, mixed separators)

Datum: 2026-04-02

## Kontext
Nach Patch 700 lief die Windows-Haertung bereits deutlich besser. Im direkten Durchlauf-11-Follow-up wurden verbleibende Path-Kanten explizit nachgezogen, damit die Safety-Logik und Regressionen die praktischen Windows-/Mixed-Faelle vollstaendig abdecken.

## Befund
- `C:temp\\...` (Drive-relative) wurde durch den bisherigen Regex `^[A-Za-z]:[\\/]` noch nicht explizit geblockt.
- Zusatzaussagen zu UNC-/Backslash-root-/mixed-separator-/Null-Byte-Faellen sollten explizit regressionssicher sein.

## Fix
- `isUnsafePatchPath(...)` blockt jetzt jedes Laufwerks-Praefix `^[A-Za-z]:` (nicht nur drive-absolute mit Slash/Backslash).
- `__tests__/patchEngine.pathSafety.test.ts` erweitert um:
  - `C:temp\\secret.txt` (drive-relative)
  - `\\\\server\\share\\secrets.txt` (UNC)
  - `\\windows\\temp.txt` (backslash-root)
  - `safe/..\\secrets.txt` (mixed separator traversal)
  - `safe/\0secrets.txt` (Null-Byte)

## Validierung
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/patchEngine.pathSafety.test.ts`
- `npm run test:silent`
- `bash scripts/check_patch_docs_sync.sh`
