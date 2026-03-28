# Patch 559 — ZIP-Import-/Persistence-Haertung (strict all-or-nothing)

## Ziel
Den ZIP-Import-Pfad minimal, ehrlich und widerspruchsfrei machen:

- globales Dateilimit ueber rekursive Verzeichnisse wirklich global erzwingen
- keinen Widerspruch mehr zwischen Validator und Import-Code
- klarer Import-Vertrag: **strict all-or-nothing** (keine Teiluebernahme)

## Umsetzung

### 1) Rekursiver ZIP-Read (`infra/storage/persistenceHelpers.ts`)
- `readDirectoryRecursive(...)` nutzt jetzt einen gemeinsamen Rekursions-Kontext (`filesRead`, `maxFiles`).
- Das Limit `MAX_FILES_IN_ZIP` gilt dadurch global ueber den gesamten ZIP-Baum, nicht mehr pro Teilrekursion.
- Bei Limit-Ueberlauf wird der Import sofort mit Fehler abgebrochen.
- Dateien ueber `MAX_FILE_SIZE_BYTES` werden nicht mehr still "uebersprungen", sondern fuehren zum klaren Gesamtfehler.

### 2) Import-Semantik (`infra/storage/projectPersistence.ts`)
- `importProjectFromZipFile(...)` nutzt jetzt denselben strikten Vertrag wie der Validator:
  - wenn `validateZipImport(...)` invalid meldet, ist der komplette Import invalid
  - kein Warn-/Skip-Pfad "ungueltige Dateien uebersprungen" mehr
- Fehlermeldung nennt explizit den strikten Vertrag und zeigt eine kurze Beispiel-Liste invaliden Dateien.

### 3) Validator-Vertrag (`lib/validators.ts`)
- `validateZipImport([])` liefert jetzt explizit `ZIP enthält keine Dateien`.
- Invalid-Dateien melden konsistent den strict-Vertrag (`ZIP enthält ungültige Dateien (strict all-or-nothing)`).

## Tests
- Aktualisiert: `lib/__tests__/validators.test.ts`
  - strict-Vertrag bei invalid/oversize Dateien
  - leeres ZIP als harter Fehler
- Neu: `__tests__/persistenceHelpers.readDirectoryRecursive.test.ts`
  - globales Dateilimit ueber verschachtelte Verzeichnisse
- Neu: `__tests__/projectPersistence.zipImportContract.test.ts`
  - Import-Fehlertext bestaetigt strict all-or-nothing ohne Skip-Wording

## Validierung
- `npm run typecheck` ✅
- `npm run lint:ci` ✅
- `npm run test:silent -- --runInBand lib/__tests__/validators.test.ts __tests__/persistenceHelpers.readDirectoryRecursive.test.ts __tests__/projectPersistence.zipImportContract.test.ts` ✅
- `npm run test:silent` ⚠️ (1 bekannter Timeout-Fall in `__tests__/localRemoteDiffSection.truthfulness.test.tsx`)
- `git diff --check` ✅
- `bash scripts/check_patch_docs_sync.sh` ✅
