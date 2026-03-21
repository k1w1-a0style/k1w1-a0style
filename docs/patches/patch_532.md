# Patch 532 — README auf Runtime-Dependency-Autofix-Stand korrigieren

## Ziel
Die Root-README soll den aktuellen Diagnose-/Autofix-Stand korrekt widerspiegeln und nicht mehr bei Patch 530 stehen bleiben, nachdem Patch 531 die Runtime-Dependency-Autofix-Abdeckung erweitert hat.

## Änderungen
- `README.md`
  - Einstiegspunkt „Aktueller Stand“ auf Patch 531 aktualisiert.
  - Kurzbeschreibung fuer den aktuellen Runtime-Dependency-Autofix um die neue Lockfile-Wiederverwendung (`package-lock.json` / `npm-shrinkwrap.json`) ergaenzt.
- Patch-Doku / Checklog fuer diese README-Korrektur nachgezogen.

## Tests
- `npm run typecheck`
- `npm run lint:ci`
- `npm run test:silent -- --runInBand __tests__/preflight.runtimeImportDependencies.test.ts`
